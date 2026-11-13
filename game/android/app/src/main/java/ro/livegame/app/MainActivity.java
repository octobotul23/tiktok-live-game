package ro.livegame.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Jocul pe tot ecranul, pentru LIVE cu partajarea ecranului:
 * fără bara de sus și butoanele de jos, ecranul nu se stinge, iar „Înapoi” cere două apăsări.
 */
public class MainActivity extends BridgeActivity {
    /** Cât timp are a doua apăsare pe „Înapoi” ca să închidă aplicația. */
    private static final long BACK_CONFIRM_MS = 2000;
    private long lastBackPress = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ecranul rămâne aprins cât e aplicația deschisă (în live nu atingi telefonul).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Jocul ocupă și zona camerei frontale (notch), ca să nu rămână o bandă neagră.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
        hideSystemBars();

        // O apăsare greșită pe „Înapoi” în timpul live-ului nu închide jocul.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                long now = System.currentTimeMillis();
                if (now - lastBackPress < BACK_CONFIRM_MS) {
                    finish();
                } else {
                    lastBackPress = now;
                    Toast.makeText(MainActivity.this, R.string.back_again_to_exit, Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Barele reapar după notificări sau după tastatură; le ascundem din nou.
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        // Glisarea de la margine le arată temporar, apoi dispar singure.
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
