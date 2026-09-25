import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:path_provider/path_provider.dart';

import '../api/kcpl_api.dart' show ApiException;
import '../api/models.dart' show Attachment;
import '../auth/auth_repository.dart' show SignedOutException;
import 'ops_api.dart';

/// A field note written where there was no signal: kept on the phone and
/// sent, in the order written, once KCPL can be reached.
class QueuedNote {
  const QueuedNote({
    required this.id,
    required this.owner,
    required this.reference,
    required this.text,
    required this.createdAt,
    this.photo,
    this.documentType = 'other',
    this.refusal,
  });

  final String id;

  /// The login that wrote it. Only that login sees or sends it.
  final String owner;
  final String reference;
  final String text;
  final DateTime createdAt;
  final Attachment? photo;
  final String documentType;

  /// KCPL refused it (not a signal problem): shown so the writer can decide.
  final String? refusal;

  QueuedNote refused(String reason) => QueuedNote(
    id: id,
    owner: owner,
    reference: reference,
    text: text,
    createdAt: createdAt,
    photo: photo,
    documentType: documentType,
    refusal: reason,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'owner': owner,
    'reference': reference,
    'text': text,
    'createdAt': createdAt.toUtc().toIso8601String(),
    'documentType': documentType,
    'refusal': refusal,
    if (photo != null) 'photo': {'filename': photo!.filename, 'contentType': photo!.contentType, 'bytes': base64Encode(photo!.bytes)},
  };

  static QueuedNote? fromJson(Map<String, dynamic> j) {
    try {
      final photo = j['photo'] as Map?;
      return QueuedNote(
        id: j['id'] as String,
        owner: j['owner'] as String,
        reference: j['reference'] as String,
        text: j['text'] as String? ?? '',
        createdAt: DateTime.parse(j['createdAt'] as String),
        documentType: j['documentType'] as String? ?? 'other',
        refusal: j['refusal'] as String?,
        photo: photo == null
            ? null
            : Attachment(
                filename: photo['filename'] as String,
                contentType: photo['contentType'] as String,
                bytes: base64Decode(photo['bytes'] as String),
              ),
      );
    } catch (_) {
      return null;
    }
  }
}

/// Where the queue is kept between launches.
abstract class NoteQueueStore {
  Future<List<QueuedNote>> load();
  Future<void> save(List<QueuedNote> notes);
}

class MemoryNoteQueueStore implements NoteQueueStore {
  List<QueuedNote> saved = [];

  @override
  Future<List<QueuedNote>> load() async => [...saved];

  @override
  Future<void> save(List<QueuedNote> notes) async => saved = [...notes];
}

/// One file in the app's private storage, written beside and renamed so a
/// crash mid-write never loses what was already queued.
class FileNoteQueueStore implements NoteQueueStore {
  FileNoteQueueStore([Future<Directory> Function()? root]) : _root = root ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _root;

  Future<File> _file() async => File('${(await _root()).path}/kcpl-outbox/notes.json');

  @override
  Future<List<QueuedNote>> load() async {
    try {
      final file = await _file();
      if (!await file.exists()) return [];
      final rows = jsonDecode(await file.readAsString()) as List;
      return rows.whereType<Map>().map((e) => QueuedNote.fromJson(e.cast<String, dynamic>())).whereType<QueuedNote>().toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> save(List<QueuedNote> notes) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    final temp = File('${file.path}.part');
    await temp.writeAsString(jsonEncode([for (final note in notes) note.toJson()]), flush: true);
    await temp.rename(file.path);
  }
}

/// The outbox for field notes. Sending is retried when the app comes back to
/// the foreground and every [retryEvery] while anything is waiting; a note
/// KCPL refuses outright is kept, marked, rather than retried for ever.
class NoteQueue extends ChangeNotifier {
  NoteQueue({NoteQueueStore? store, this.retryEvery = const Duration(seconds: 45)}) : _store = store ?? MemoryNoteQueueStore();

  final NoteQueueStore _store;
  final Duration retryEvery;

  List<QueuedNote> _notes = [];
  String? _owner;
  OpsApi? _api;
  Timer? _timer;
  AppLifecycleListener? _lifecycle;
  bool _sending = false;

  /// Whether a note can be kept here: someone is signed in and known.
  bool get ready => _owner != null;

  /// What the signed-in login has waiting, oldest first.
  List<QueuedNote> get waiting => _notes.where((n) => n.owner == _owner).toList();

  List<QueuedNote> waitingFor(String reference) => waiting.where((n) => n.reference == reference).toList();

  /// Starts sending for [owner]. Called once signed in.
  Future<void> attach(OpsApi api, String owner) async {
    _api = api;
    _owner = owner.toLowerCase();
    _notes = await _store.load();
    _lifecycle ??= AppLifecycleListener(onResume: () => flush().ignore());
    notifyListeners();
    await flush();
  }

  /// Stops sending. The notes stay on the phone for their writer.
  void detach() {
    _api = null;
    _owner = null;
    _timer?.cancel();
    _timer = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    notifyListeners();
  }

  Future<QueuedNote> add(String reference, {String text = '', Attachment? photo, String documentType = 'other'}) async {
    final owner = _owner;
    if (owner == null) throw StateError('No one is signed in.');
    final note = QueuedNote(
      id: 'q-${DateTime.now().microsecondsSinceEpoch}',
      owner: owner,
      reference: reference,
      text: text,
      createdAt: DateTime.now(),
      photo: photo,
      documentType: documentType,
    );
    _notes = [..._notes, note];
    await _store.save(_notes);
    notifyListeners();
    _schedule();
    return note;
  }

  Future<void> discard(String id) async {
    _notes = _notes.where((n) => n.id != id).toList();
    await _store.save(_notes);
    notifyListeners();
    _schedule();
  }

  /// Sends what is waiting, in order. Stops at the first sign there is still
  /// no signal; true when something was sent.
  Future<bool> flush() async {
    final api = _api;
    if (api == null || _sending) return false;
    _sending = true;
    var sent = false;
    try {
      for (final note in waiting.where((n) => n.refusal == null)) {
        try {
          await api.addNote(note.reference, text: note.text, photo: note.photo, documentType: note.documentType);
          _notes = _notes.where((n) => n.id != note.id).toList();
          sent = true;
        } on ApiException catch (error) {
          if (error.code == 'network' || error.status >= 500) break;
          _notes = [for (final n in _notes) n.id == note.id ? n.refused(error.message.isEmpty ? 'KCPL did not accept this note.' : error.message) : n];
        } on SignedOutException {
          break;
        }
        await _store.save(_notes);
        notifyListeners();
      }
    } finally {
      _sending = false;
      _schedule();
    }
    return sent;
  }

  void _schedule() {
    final pending = _api != null && waiting.any((n) => n.refusal == null);
    if (!pending) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(retryEvery, (_) => flush().ignore());
    }
  }

  @override
  void dispose() {
    detach();
    super.dispose();
  }
}
