package com.roomia.pms;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Envía un PDF (en base64) al servicio de impresión de Android.
 * El WebView no soporta window.print(), por eso la app lo hace de forma nativa.
 * El diálogo del sistema también permite "Guardar como PDF".
 */
@CapacitorPlugin(name = "RoomiaPrint")
public class RoomiaPrintPlugin extends Plugin {

    @PluginMethod
    public void printPdf(PluginCall call) {
        String base64 = call.getString("base64");
        final String jobName = call.getString("name", "Roomia");
        final double widthMm = call.getDouble("widthMm", 0.0);
        final double heightMm = call.getDouble("heightMm", 0.0);
        if (base64 == null || base64.isEmpty()) {
            call.reject("No se recibió el PDF");
            return;
        }

        final byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("El PDF no es válido");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override
                    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                         CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                        if (cancellationSignal.isCanceled()) {
                            callback.onLayoutCancelled();
                            return;
                        }
                        PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName + ".pdf")
                                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                .build();
                        callback.onLayoutFinished(info, true);
                    }

                    @Override
                    public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                        CancellationSignal cancellationSignal, WriteResultCallback callback) {
                        try (OutputStream out = new FileOutputStream(destination.getFileDescriptor())) {
                            out.write(pdfBytes);
                            callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                        } catch (IOException e) {
                            callback.onWriteFailed(e.getMessage());
                        }
                    }
                };
                // Ticket térmico: se propone el tamaño de papel del PDF (ancho x alto en mm)
                PrintAttributes attributes = null;
                if (widthMm > 0 && heightMm > 0) {
                    int widthMils = (int) Math.round(widthMm / 25.4 * 1000);
                    int heightMils = (int) Math.round(heightMm / 25.4 * 1000);
                    attributes = new PrintAttributes.Builder()
                            .setMediaSize(new PrintAttributes.MediaSize("roomia_ticket", "Ticket " + Math.round(widthMm) + " mm", widthMils, heightMils))
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();
                }
                printManager.print(jobName, adapter, attributes);
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo abrir la impresión: " + e.getMessage());
            }
        });
    }
}
