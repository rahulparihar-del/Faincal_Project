"use client";

/**
 * Generate Code128 barcode on a canvas element.
 * Returns the barcode data URL (PNG).
 */
export async function generateBarcodeDataUrl(barcodeValue: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
}): Promise<string> {
  // Dynamic import so it doesn't break SSR
  const JsBarcodeLib = (await import('jsbarcode')).default;
  const canvas = document.createElement('canvas');
  JsBarcodeLib(canvas, barcodeValue, {
    format: 'CODE128',
    width: options?.width ?? 2,
    height: options?.height ?? 60,
    displayValue: options?.displayValue ?? true,
    fontSize: options?.fontSize ?? 12,
    margin: options?.margin ?? 8,
    background: '#ffffff',
    lineColor: '#000000',
    font: 'monospace',
  });
  return canvas.toDataURL('image/png');
}

/**
 * Render barcode directly onto a canvas element by ref
 */
export async function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  barcodeValue: string,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
  }
): Promise<void> {
  const JsBarcodeLib = (await import('jsbarcode')).default;
  JsBarcodeLib(canvas, barcodeValue, {
    format: 'CODE128',
    width: options?.width ?? 2,
    height: options?.height ?? 60,
    displayValue: options?.displayValue ?? true,
    fontSize: options?.fontSize ?? 12,
    margin: options?.margin ?? 8,
    background: options?.background ?? '#ffffff',
    lineColor: options?.lineColor ?? '#000000',
    font: 'monospace',
  });
}

/**
 * Generate a unique barcode value for a SKU
 * Format: KK{CATEGORY_CODE}{RANDOM_6_DIGITS}
 * Example: KKCJ482910
 */
export function generateBarcodeValue(sku: string): string {
  // Use SKU as-is for scanners (most thermal printers work with alphanumeric)
  // Strip hyphens to keep it compact for Code128
  return sku.replace(/-/g, '');
}

/**
 * Download barcode as PNG file
 */
export async function downloadBarcodeAsPng(barcodeValue: string, filename: string): Promise<void> {
  const dataUrl = await generateBarcodeDataUrl(barcodeValue);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
