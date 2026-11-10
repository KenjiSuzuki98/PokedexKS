/**
 * Leitura de texto do print, grátis e no próprio aparelho (Tesseract.js).
 * Na primeira vez baixa o motor e os idiomas (~15 MB); depois fica em cache.
 * Fica fora dos testes automáticos: os testes usam um leitor falso e testam o interpretador do texto.
 */
export async function recognizeImage(file: File): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['por', 'eng']);
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
