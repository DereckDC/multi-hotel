// Guardar, compartir e imprimir PDFs dentro de la app Android (Capacitor).
// En el WebView no funcionan las descargas por enlace ni window.print().
import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface RoomiaPrintPlugin {
  printPdf(options: { base64: string; name: string }): Promise<void>;
}

const RoomiaPrint = registerPlugin<RoomiaPrintPlugin>('RoomiaPrint');

/** Quita el prefijo data:...;base64, si viene incluido */
const cleanBase64 = (data: string) => data.replace(/^data:[^,]*,/, '');

/**
 * Guarda el PDF en Documentos/Roomia (o en caché si no se puede) y abre la hoja de compartir
 * para que el usuario lo abra, lo guarde en Drive o lo envíe.
 * Devuelve true si quedó guardado en Documentos.
 */
export async function savePdfNative(base64: string, fileName: string, title: string): Promise<boolean> {
  const data = cleanBase64(base64);
  let uri: string;
  let savedInDocuments = false;
  try {
    const res = await Filesystem.writeFile({ path: `Roomia/${fileName}`, data, directory: Directory.Documents, recursive: true });
    uri = res.uri;
    savedInDocuments = true;
  } catch {
    const res = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    uri = res.uri;
  }
  try {
    await Share.share({ title, dialogTitle: title, files: [uri] });
  } catch {
    // El usuario cerró la hoja de compartir: el archivo igual quedó guardado
  }
  return savedInDocuments;
}

/** Abre el diálogo de impresión de Android con el PDF */
export async function printPdfNative(base64: string, jobName: string): Promise<void> {
  await RoomiaPrint.printPdf({ base64: cleanBase64(base64), name: jobName });
}
