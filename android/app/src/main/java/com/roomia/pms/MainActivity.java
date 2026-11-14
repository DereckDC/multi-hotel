package com.roomia.pms;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio para imprimir facturas (el WebView no soporta window.print)
        registerPlugin(RoomiaPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
