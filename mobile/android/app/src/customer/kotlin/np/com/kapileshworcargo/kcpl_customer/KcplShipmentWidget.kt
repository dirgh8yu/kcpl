package np.com.kapileshworcargo.kcpl_customer

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Draws what the app last wrote (lib/platform/home_widget_bridge.dart): the
 * route, its status and where it is, and how far along. Every word arrives
 * already in the reader's language. A tap opens that shipment.
 */
class KcplShipmentWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        val reference = widgetData.getString("kcpl_reference", null)
        val attention = widgetData.getBoolean("kcpl_attention", false)
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.kcpl_shipment_widget)
            views.setTextViewText(
                R.id.kcpl_route,
                widgetData.getString("kcpl_route", null) ?: context.getString(R.string.kcpl_widget_empty),
            )
            views.setTextViewText(R.id.kcpl_status, widgetData.getString("kcpl_status", "") ?: "")
            views.setTextColor(
                R.id.kcpl_status,
                context.getColor(if (attention) R.color.kcpl_crimson else R.color.kcpl_widget_ink),
            )
            views.setTextViewText(R.id.kcpl_detail, widgetData.getString("kcpl_detail", "") ?: "")
            views.setTextViewText(R.id.kcpl_summary, widgetData.getString("kcpl_summary", "") ?: "")
            views.setTextViewText(R.id.kcpl_reference, reference ?: "")
            views.setProgressBar(R.id.kcpl_progress, 100, widgetData.getInt("kcpl_progress", 0), false)
            views.setViewVisibility(R.id.kcpl_progress, if (reference == null) View.GONE else View.VISIBLE)
            val open = if (reference == null) null else Uri.parse("kcpl://shipment/$reference")
            views.setOnClickPendingIntent(R.id.kcpl_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, open))
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
