package np.com.kapileshworcargo.kcpl_customer

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

// A FlutterFragmentActivity, as Face ID's Android counterpart (the biometric
// prompt) requires.
class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Reads the text in a photo (a container number painted on a door, a
        // reference on a document) on the phone, through Google Play
        // services. The iOS side is in AppDelegate.swift.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "kcpl/text").setMethodCallHandler { call, result ->
            if (call.method != "recognize") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val path = call.argument<String>("path")
            val image = try {
                if (path == null) null else InputImage.fromFilePath(this, Uri.fromFile(File(path)))
            } catch (error: Exception) {
                null
            }
            if (image == null) {
                result.success(emptyList<String>())
                return@setMethodCallHandler
            }
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            recognizer.process(image)
                .addOnSuccessListener { text ->
                    result.success(text.textBlocks.flatMap { block -> block.lines.map { it.text } })
                    recognizer.close()
                }
                .addOnFailureListener {
                    result.success(emptyList<String>())
                    recognizer.close()
                }
        }
    }
}
