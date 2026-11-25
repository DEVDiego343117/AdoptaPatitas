import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export const roles = ['Adoptante', 'Rescatista', 'Administrador'] as const;
export const tamanos = ['Pequeño', 'Mediano', 'Grande'] as const;
export const sexos = ['Macho', 'Hembra'] as const;
export const estados = ['Disponible', 'Adoptado', 'NoDisponible'] as const;
export type Rol = typeof roles[number];
export type Decision = 'Aprobada' | 'Rechazada';
export interface Cuenta { id: number; nombre: string; correo: string; roles: Rol[]; }
export interface Perfil extends Cuenta { telefono: string | null; }
export interface Usuario extends Perfil { activo: boolean; }
export interface Ficha {
  nombre: string;
  edadMeses: number;
  tamano: typeof tamanos[number];
  sexo: typeof sexos[number];
  estado: typeof estados[number];
  raza: string | null;
  descripcion: string | null;
}
export interface Perro extends Ficha { id: number; responsableId: number; fotos: string[]; }
export interface SolicitudCreada { id: number; perroId: number; estado: 'Pendiente' | Decision; fechaCreacion: string; }
export interface Solicitud extends SolicitudCreada { perro: string; mensaje: string | null; fotos: string[]; }
export interface Recibida extends Solicitud { adoptante: Omit<Perfil, 'roles'>; }

const base = '/api';
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private get<T>(path: string, params: Record<string, string | number> = {}) {
    return firstValueFrom(this.http.get<T>(base + path, { params }));
  }
  private send<T>(method: string, path: string, body?: unknown) {
    return firstValueFrom(this.http.request<T>(method, base + path, { body }));
  }
  perfil() { return this.get<Perfil>('/usuarios/mi-perfil'); }
  login(datos: { correo: string; password: string }) { return this.send<Cuenta>('POST', '/usuarios/login', datos); }
  registro(datos: { nombre: string; correo: string; password: string; telefono: string | null; esRescatista: boolean }) {
    return this.send<Cuenta>('POST', '/usuarios/registro', datos);
  }
  logout() { return this.send<void>('POST', '/usuarios/logout'); }
  editarPerfil(datos: Pick<Perfil, 'nombre' | 'telefono'>) { return this.send<void>('PUT', '/usuarios/mi-perfil', datos); }
  catalogo(filtros?: Record<string, string | number>) { return this.get<Perro[]>('/perros', filtros); }
  perro(id: number) { return this.get<Perro>('/perros/' + id); }
  publicaciones(todas: boolean) { return this.get<Perro[]>('/perros/' + (todas ? 'administracion' : 'mis-publicaciones')); }
  crear(datos: Ficha, fotos: readonly File[]) {
    if (!fotos.length) return this.send<Perro>('POST', '/perros', datos);
    const form = new FormData();
    for (const [key, value] of Object.entries(datos)) if (value !== null) form.append(key, String(value));
    for (const foto of fotos) form.append('fotos', foto);
    return this.send<Perro>('POST', '/perros', form);
  }
  editar(id: number, datos: Ficha) { return this.send<void>('PUT', '/perros/' + id, datos); }
  borrar(id: number) { return this.send<void>('DELETE', '/perros/' + id); }
  subir(id: number, archivo: File) {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.send<{ key: string; url: string }>('POST', '/perros/' + id + '/fotos', form);
  }
  quitarFoto(id: number, indice: number) { return this.send<void>('DELETE', '/perros/' + id + '/fotos/' + indice); }
  solicitar(perroId: number, mensaje: string | null) { return this.send<SolicitudCreada>('POST', '/solicitudes', { perroId, mensaje }); }
  historial() { return this.get<Solicitud[]>('/solicitudes/mis-solicitudes'); }
  recibidas() { return this.get<Recibida[]>('/solicitudes/recibidas'); }
  decidir(id: number, estado: Decision) { return this.send<void>('PATCH', '/solicitudes/' + id + '/estado', { estado }); }
  usuarios() { return this.get<Usuario[]>('/usuarios'); }
  permisos(id: number, datos: Pick<Usuario, 'roles' | 'activo'>) {
    return this.send<void>('PUT', '/usuarios/' + id + '/roles', datos);
  }
}

@Injectable({ providedIn: 'root' })
export class Sesion {
  private api = inject(Api);
  readonly usuario = signal<Perfil | null>(null);
  readonly lista = signal(false);
  private pendiente?: Promise<void>;

  recuperar() {
    if (this.lista()) return Promise.resolve();
    return this.pendiente ??= this.api.perfil().then(perfil => {
      this.usuario.set(perfil);
    }).catch(e => {
      if (e.status !== 401) throw e;
    }).then(() => this.lista.set(true)).finally(() => this.pendiente = undefined);
  }

  tiene(...permitidos: Rol[]) { return this.usuario()?.roles.some(rol => permitidos.includes(rol)) ?? false; }

  async entrar(datos: { correo: string; password: string }) {
    const cuenta = await this.api.login(datos);
    this.usuario.set({ ...cuenta, telefono: null });
    this.lista.set(true);
  }

  invalidar() {
    this.usuario.set(null);
    this.lista.set(true);
  }
}

export const credenciales: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(base + '/')) return next(req);
  const sesion = inject(Sesion);
  return next(req.clone({ withCredentials: true })).pipe(catchError(error => {
    if (error.status === 401 && req.url !== base + '/usuarios/login') sesion.invalidar();
    return throwError(() => error);
  }));
};

export function proteger(...permitidos: Rol[]): CanActivateFn {
  return async (_route, state) => {
    const sesion = inject(Sesion);
    const router = inject(Router);
    try { await sesion.recuperar(); }
    catch { return router.createUrlTree(['/sesion-no-disponible'], { queryParams: { volver: state.url } }); }
    if (!sesion.usuario()) return router.createUrlTree(['/entrar'], { queryParams: { volver: state.url } });
    return !permitidos.length || sesion.tiene(...permitidos) || router.createUrlTree(['/sin-acceso']);
  };
}

export function mensajeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'No pudimos completar la operación. Intenta de nuevo.';
  if (error.status >= 500 || error.status === 0) return 'No pudimos comunicarnos con el servicio. Intenta de nuevo.';
  if (typeof error.error === 'string' && error.error.trim()) return error.error;
  if (error.error?.errors) return 'Revisa los campos del formulario y sus límites.';
  switch (error.status) {
    case 401: return 'Tu sesión no está activa. Inicia sesión para continuar.';
    case 403: return 'Tu cuenta no tiene permiso para esta acción.';
    case 404: return 'El recurso no está disponible.';
    case 409: return 'Los datos cambiaron. Actualiza la página e intenta de nuevo.';
    case 413: return 'La carga es demasiado grande. Selecciona menos fotos.';
    default: return 'Revisa la información e intenta de nuevo.';
  }
}
