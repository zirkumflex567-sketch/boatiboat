package de.boatiboat.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private WebView webView;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246, 243, 234));

        webView = new WebView(this);
        webView.setVisibility(View.INVISIBLE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        status = new TextView(this);
        status.setText("Boatiboat lädt...");
        status.setTextColor(Color.rgb(16, 33, 43));
        status.setTextSize(18);
        status.setGravity(Gravity.CENTER);
        status.setPadding(32, 32, 32, 32);

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        root.addView(status, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                status.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    status.setText("Boatiboat ist gerade nicht erreichbar. Bitte Verbindung prüfen und neu öffnen.");
                    status.setVisibility(View.VISIBLE);
                    webView.setVisibility(View.INVISIBLE);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                status.setText("Die sichere Verbindung konnte nicht geprüft werden.");
                status.setVisibility(View.VISIBLE);
                webView.setVisibility(View.INVISIBLE);
            }
        });

        webView.loadUrl(getString(getResources().getIdentifier("app_url", "string", getPackageName())));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
