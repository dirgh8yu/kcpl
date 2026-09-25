package np.com.kapileshworcargo.kcpl_live_updates;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * A shipment kept on the lock screen and in the status bar while it moves:
 * Android's answer to the iOS Live Activity, on the same channel
 * ("kcpl/live_activity") and with the same four fields (lib/platform/
 * live_activity.dart). On Android 16 it is a Live Update: a progress-centric
 * notification the system may promote to the top of the lock screen and to
 * a chip in the status bar. Before that it is an ongoing notification with a
 * progress bar.
 *
 * A plugin rather than code in MainActivity so that it is also registered in
 * the engine Firebase Messaging starts for a push that arrives while the app
 * is closed: KCPL's server moves it (a "live" data message, handled by
 * "push"), as it moves a Live Activity on iOS. A tap opens the shipment, as
 * the home screen widget does.
 */
public class KcplLiveUpdatesPlugin implements FlutterPlugin, MethodChannel.MethodCallHandler {
    static final String CHANNEL_ID = "kcpl_live";
    static final int NOTIFICATION_ID = 7100;
    static final String TAG_PREFIX = "kcpl-live:";
    static final String EXTRA_FOLLOW = "kcpl.follow";
    static final String EXTRA_ROUTE = "kcpl.route";
    // The Live Update request, set as its extra as AndroidX's NotificationCompat
    // does: the builder method is newer than the SDK this compiles against.
    static final String EXTRA_REQUEST_PROMOTED_ONGOING = "android.requestPromotedOngoing";
    // home_widget's launch action: the app already turns it into "open this
    // shipment" (lib/platform/home_widget_bridge.dart).
    static final String LAUNCH_ACTION = "es.antonborri.home_widget.action.LAUNCH";

    private MethodChannel channel;
    private Context context;

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        context = binding.getApplicationContext();
        channel = new MethodChannel(binding.getBinaryMessenger(), "kcpl/live_activity");
        channel.setMethodCallHandler(this);
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        channel.setMethodCallHandler(null);
        channel = null;
    }

    private NotificationManager manager() {
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        try {
            switch (call.method) {
                case "supported":
                    result.success(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager().areNotificationsEnabled());
                    return;
                case "running":
                    result.success(running());
                    return;
                case "start":
                case "update": {
                    String reference = call.argument("reference");
                    if (reference == null || reference.trim().isEmpty()) reference = call.argument("id");
                    if (reference == null || reference.trim().isEmpty()) {
                        result.error("invalid", "No shipment.", null);
                        return;
                    }
                    result.success(post(reference, call, false));
                    return;
                }
                case "push": {
                    // From KCPL's server: move a follow that is still showing,
                    // end it on delivery. One the person swiped away stays gone.
                    String reference = call.argument("reference");
                    if (reference == null || reference.isEmpty()) {
                        result.success(null);
                        return;
                    }
                    if (Boolean.TRUE.equals(call.argument("end"))) {
                        manager().cancel(TAG_PREFIX + reference, NOTIFICATION_ID);
                        result.success(null);
                        return;
                    }
                    result.success(post(reference, call, true));
                    return;
                }
                case "end": {
                    String id = call.argument("id");
                    if (id != null) manager().cancel(TAG_PREFIX + id, NOTIFICATION_ID);
                    result.success(null);
                    return;
                }
                default:
                    result.notImplemented();
            }
        } catch (Exception error) {
            // Refused by the system (notifications off, a channel blocked):
            // the lock screen is a courtesy, never a failure of the app.
            result.error("unavailable", error.getMessage(), null);
        }
    }

    private StatusBarNotification showing(String reference) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null;
        for (StatusBarNotification item : manager().getActiveNotifications()) {
            if (item.getId() == NOTIFICATION_ID && (TAG_PREFIX + reference).equals(item.getTag())) return item;
        }
        return null;
    }

    private List<Map<String, Object>> running() {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return rows;
        for (StatusBarNotification item : manager().getActiveNotifications()) {
            String tag = item.getTag();
            if (item.getId() != NOTIFICATION_ID || tag == null || !tag.startsWith(TAG_PREFIX)) continue;
            String reference = tag.substring(TAG_PREFIX.length());
            Map<String, Object> row = new HashMap<>();
            row.put("id", reference);
            row.put("reference", reference);
            row.put("token", item.getNotification().extras.getString(EXTRA_FOLLOW));
            rows.add(row);
        }
        return rows;
    }

    /** Posts or moves the follow; null when [onlyIfShowing] and it isn't. */
    private Map<String, Object> post(String reference, MethodCall call, boolean onlyIfShowing) {
        StatusBarNotification current = showing(reference);
        if (onlyIfShowing && current == null) return null;
        Bundle kept = current == null ? new Bundle() : current.getNotification().extras;

        String route = call.argument("route");
        if (route == null || route.isEmpty()) route = kept.getString(EXTRA_ROUTE, reference);
        String follow = kept.getString(EXTRA_FOLLOW);
        if (follow == null) follow = "android:" + UUID.randomUUID().toString().replace("-", "");
        String status = call.argument("status");
        String detail = call.argument("detail");
        Object rawProgress = call.argument("progress");
        double fraction = rawProgress instanceof Number ? ((Number) rawProgress).doubleValue() : 0;
        int progress = (int) Math.round(Math.max(0, Math.min(1, fraction)) * 100);
        boolean attention = Boolean.TRUE.equals(call.argument("attention"));
        ensureChannel(call.argument("channel"));

        int crimson = color("kcpl_crimson", 0xFFDC143C);
        StringBuilder text = new StringBuilder(status == null ? "" : status.trim());
        if (detail != null && !detail.trim().isEmpty()) text.append(text.length() > 0 ? " · " : "").append(detail.trim());

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);
        Bundle extras = new Bundle();
        extras.putString(EXTRA_FOLLOW, follow);
        extras.putString(EXTRA_ROUTE, route);
        builder.setSmallIcon(icon())
                .setColor(crimson)
                .setContentTitle(route)
                .setContentText(text.toString())
                .setSubText(reference)
                .setContentIntent(open(reference))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(attention ? Notification.CATEGORY_STATUS : Notification.CATEGORY_PROGRESS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .addExtras(extras);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
            List<Notification.ProgressStyle.Segment> segments = new ArrayList<>();
            segments.add(new Notification.ProgressStyle.Segment(100).setColor(crimson));
            builder.setStyle(new Notification.ProgressStyle().setStyledByProgress(true).setProgressSegments(segments).setProgress(progress))
                    .setShortCriticalText(progress + "%");
            Bundle promoted = new Bundle();
            promoted.putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true);
            builder.addExtras(promoted);
        } else {
            builder.setProgress(100, progress, false);
        }
        manager().notify(TAG_PREFIX + reference, NOTIFICATION_ID, builder.build());

        Map<String, Object> handle = new HashMap<>();
        handle.put("id", reference);
        handle.put("reference", reference);
        handle.put("token", follow);
        return handle;
    }

    /** A new channel takes the reader's words; one already made keeps its own. */
    private void ensureChannel(String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = manager();
        if (manager.getNotificationChannel(CHANNEL_ID) != null && (name == null || name.trim().isEmpty())) return;
        // Low: it moves quietly. A Live Update may not use a minimum-importance
        // channel, and a sound on every step would be a nuisance.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, name == null || name.trim().isEmpty() ? "Shipment progress" : name.trim(), NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private PendingIntent open(String reference) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        Intent intent = new Intent(LAUNCH_ACTION, Uri.parse("kcpl://shipment/" + reference));
        if (launch != null && launch.getComponent() != null) intent.setComponent(launch.getComponent());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= 35) {
            ActivityOptions options = ActivityOptions.makeBasic();
            options.setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
            return PendingIntent.getActivity(context, reference.hashCode(), intent, flags, options.toBundle());
        }
        return PendingIntent.getActivity(context, reference.hashCode(), intent, flags);
    }

    private int icon() {
        int id = context.getResources().getIdentifier("ic_notification", "drawable", context.getPackageName());
        return id != 0 ? id : context.getApplicationInfo().icon;
    }

    private int color(String name, int fallback) {
        int id = context.getResources().getIdentifier(name, "color", context.getPackageName());
        return id != 0 ? context.getColor(id) : fallback;
    }
}
