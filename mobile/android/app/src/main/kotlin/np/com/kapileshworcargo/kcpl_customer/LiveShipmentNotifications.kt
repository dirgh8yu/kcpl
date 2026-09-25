package np.com.kapileshworcargo.kcpl_customer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Build
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * A shipment kept on the lock screen and in the status bar while it moves:
 * Android's answer to the iOS Live Activity, on the same channel
 * ("kcpl/live_activity") and with the same four fields (lib/platform/
 * live_activity.dart). On Android 16 it is a Live Update: a progress-centric
 * notification the system may promote to the top of the shade and to a chip
 * in the status bar. Before that it is an ongoing notification with a
 * progress bar. The app moves it whenever it reads the shipment; a tap opens
 * that shipment, as the home screen widget does.
 */
class LiveShipmentNotifications(private val context: Context) : MethodChannel.MethodCallHandler {
    private val manager = context.getSystemService(NotificationManager::class.java)

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "supported" -> result.success(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.areNotificationsEnabled())
                "running" -> result.success(running())
                "start", "update" -> {
                    val reference = call.argument<String>("reference") ?: call.argument<String>("id")
                    if (reference.isNullOrBlank()) {
                        result.error("invalid", "No shipment.", null)
                        return
                    }
                    post(reference, call)
                    result.success(mapOf("id" to reference, "reference" to reference))
                }
                "end" -> {
                    call.argument<String>("id")?.let { manager.cancel(TAG_PREFIX + it, NOTIFICATION_ID) }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        } catch (error: Exception) {
            // Refused by the system (notifications off, a channel blocked):
            // the lock screen is a courtesy, never a failure of the app.
            result.error("unavailable", error.message, null)
        }
    }

    private fun running(): List<Map<String, Any?>> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return emptyList()
        return manager.activeNotifications
            .filter { it.id == NOTIFICATION_ID && it.tag?.startsWith(TAG_PREFIX) == true }
            .map {
                val reference = (it.tag ?: "").removePrefix(TAG_PREFIX)
                mapOf("id" to reference, "reference" to reference, "token" to null)
            }
    }

    private fun post(reference: String, call: MethodCall) {
        val route = call.argument<String>("route") ?: previousRoute(reference) ?: reference
        val status = call.argument<String>("status") ?: ""
        val detail = call.argument<String>("detail") ?: ""
        val progress = ((call.argument<Double>("progress") ?: 0.0).coerceIn(0.0, 1.0) * 100).toInt()
        val attention = call.argument<Boolean>("attention") ?: false
        routes[reference] = route
        channel(call.argument<String>("channel"))

        val open = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse("kcpl://shipment/$reference"))
        val builder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL) else Notification.Builder(context))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(context.getColor(R.color.kcpl_crimson))
            .setContentTitle(route)
            .setContentText(listOf(status, detail).filter { it.isNotBlank() }.joinToString(" · "))
            .setSubText(reference)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(if (attention) Notification.CATEGORY_STATUS else Notification.CATEGORY_PROGRESS)
            .setVisibility(Notification.VISIBILITY_PUBLIC)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
            val crimson = context.getColor(R.color.kcpl_crimson)
            builder
                .setStyle(
                    Notification.ProgressStyle()
                        .setStyledByProgress(true)
                        .setProgressSegments(listOf(Notification.ProgressStyle.Segment(100).setColor(crimson)))
                        .setProgress(progress),
                )
                .setShortCriticalText("$progress%")
                .setRequestPromotedOngoing(true)
        } else {
            builder.setProgress(100, progress, false)
        }
        manager.notify(TAG_PREFIX + reference, NOTIFICATION_ID, builder.build())
    }

    /** An update from a read carries no route; the one it started with stays. */
    private fun previousRoute(reference: String): String? = routes[reference]

    private fun channel(name: String?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        // Low: it moves quietly. A Live Update may not use a minimum-importance
        // channel, and a sound on every step would be a nuisance.
        val channel = NotificationChannel(CHANNEL, name?.takeIf { it.isNotBlank() } ?: "Shipment progress", NotificationManager.IMPORTANCE_LOW)
        channel.setShowBadge(false)
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL = "kcpl_live"
        const val NOTIFICATION_ID = 7100
        const val TAG_PREFIX = "kcpl-live:"
        private val routes = mutableMapOf<String, String>()
    }
}
