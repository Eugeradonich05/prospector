/** Supabase (PostgREST) devuelve como mucho 1000 filas por consulta: esto pide de a páginas hasta traer todo. */
export const TAMANIO_PAGINA = 1000;
const MAX_PAGINAS = 50; // tope de seguridad: 50.000 filas

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

export async function leerTodo<T>(consulta: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * TAMANIO_PAGINA;
    const { data, error } = await consulta(desde, desde + TAMANIO_PAGINA - 1);
    if (error) throw new Error(`No pude leer la base: ${error.message}`);
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < TAMANIO_PAGINA) break;
  }
  return filas;
}
