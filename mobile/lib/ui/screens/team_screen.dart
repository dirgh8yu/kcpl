import 'package:flutter/cupertino.dart' show CupertinoActionSheet, CupertinoActionSheetAction, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/share.dart';
import '../widgets/sheet_route.dart';
import '../widgets/split_view.dart';

/// Beside the settings on a tablet; as a sheet otherwise.
void openTeam(BuildContext context) {
  if (SplitView.select(context, 'team')) return;
  Navigator.of(context).push(SheetRoute<void>(builder: (_) => const TeamScreen()));
}

/// The account owner's colleagues: who can sign in, who hasn't yet, and
/// whose login is off. Adding one is the phone call to KCPL it replaces.
class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<List<TeamMember>>(title: l.teamTitle, load: api.team, builder: (context, team) => _body(context, team)),
    );
  }

  List<Widget> _body(BuildContext context, List<TeamMember> team) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final me = AppScope.of(context).session?.email.toLowerCase();
    final own = team.where((m) => !m.linked).toList();
    final linked = team.where((m) => m.linked).toList();
    return [
      RowGroup(
        indent: RowGroup.iconIndent,
        children: [
          RowTile(
            onTap: () async {
              if (await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => const InviteScreen())) == true &&
                  context.mounted) {
                await AsyncPage.reload(context);
              }
            },
            leading: Icon(KIcons.userPlus, size: 22, color: p.accent),
            title: Text(l.teamInvite, style: TextStyle(color: p.accent)),
          ),
        ],
      ),
      const SizedBox(height: 20),
      RowGroup(
        indent: RowGroup.iconIndent,
        children: [for (final member in own) _MemberRow(member, me: member.email == me)],
      ),
      Footnote(l.teamFootnote),
      if (linked.isNotEmpty) ...[
        SectionHeader(l.teamStateLinked),
        RowGroup(indent: RowGroup.iconIndent, children: [for (final member in linked) _MemberRow(member, me: false)]),
        Footnote(l.teamLinkedFootnote),
      ],
    ];
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow(this.member, {required this.me});
  final TeamMember member;
  final bool me;

  /// Only a member of this account, other than the owner, can be switched.
  bool get _changeable => !member.owner && !member.linked && !me;

  Future<void> _change(BuildContext context) async {
    final l = AppLocalizations.of(context);
    final turnOff = member.active;
    final confirmed = await showCupertinoModalPopup<bool>(
      context: context,
      builder: (sheet) => CupertinoActionSheet(
        message: turnOff ? Text(l.teamTurnOffBody(member.email)) : null,
        actions: [
          CupertinoActionSheetAction(
            isDestructiveAction: turnOff,
            onPressed: () => Navigator.pop(sheet, true),
            child: Text(turnOff ? l.teamTurnOff : l.teamTurnOn),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(sheet, false),
          child: Text(l.cancel),
        ),
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final api = AppScope.read(context).api;
    final messenger = ScaffoldMessenger.of(context);
    final error = await attempt(context, () => api.setMemberActive(member.email, !turnOff));
    if (!context.mounted) return;
    if (error != null) {
      messenger.showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    HapticFeedback.mediumImpact();
    await AsyncPage.reload(context);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final (state, emphasis) = member.linked
        ? (l.teamStateLinked, Emphasis.normal)
        : !member.active
        ? (l.teamStateOff, Emphasis.attention)
        : !member.bound
        ? (l.teamStateInvited, Emphasis.normal)
        : (member.owner ? l.roleOwner : l.teamStateActive, Emphasis.normal);
    final seen = member.lastSignInAt;
    return RowTile(
      onTap: _changeable ? () => _change(context) : null,
      leading: CircleAvatar(
        radius: 13,
        backgroundColor: p.fill,
        child: Text(member.email.characters.first.toUpperCase(), style: context.type.labelMedium?.copyWith(color: p.secondary)),
      ),
      title: Text(me ? '${member.email} (${l.teamYou})' : member.email, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(seen == null ? l.teamNeverSignedIn : l.teamLastSeen(formatDate(seen))),
      trailing: StatusText(state, emphasis),
    );
  }
}

/// One address, and the invitation goes. When KCPL has no mail provider the
/// server hands back the one-time link, and the owner passes it on.
class InviteScreen extends StatefulWidget {
  const InviteScreen({super.key});

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  TeamInvite? _invite;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    FocusScope.of(context).unfocus();
    final api = AppScope.read(context).api;
    setState(() => (_busy = true, _error = null));
    TeamInvite? invite;
    final error = await attempt(context, () async => invite = await api.invite(_email.text));
    if (!mounted) return;
    if (invite != null) HapticFeedback.mediumImpact();
    setState(() => (_busy = false, _error = error, _invite = invite));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final invite = _invite;
    if (invite != null) {
      final link = invite.link;
      return DoneView(
        title: l.teamInvited,
        body: invite.warning ?? (link != null ? l.teamInviteLinkBody(invite.email) : l.teamInviteSentBody(invite.email)),
        extra: link == null
            ? null
            : Builder(
                builder: (button) => OutlinedButton.icon(
                  onPressed: () => shareText(button, link, subject: 'KCPL'),
                  icon: const Icon(KIcons.share, size: 18),
                  label: Text(l.teamShareLink),
                ),
              ),
      );
    }
    return ComposeScaffold(
      title: l.teamInvite,
      error: _error,
      action: SendButton(label: l.teamSendInvite, onPressed: _send, busy: _busy),
      children: [
        GroupCard(
          child: TextField(
            controller: _email,
            enabled: !_busy,
            autofocus: true,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _send(),
            autofillHints: const [AutofillHints.email],
            style: context.type.bodyLarge,
            decoration: cardField(l.emailLabel),
          ),
        ),
        Footnote(l.teamInviteBody),
      ],
    );
  }
}
