import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, Routes } from '@angular/router';
import { proteger } from './api';
import { Catalogo, Detalle } from './catalogo';
import { Acceso, CuentaLayout, MiPerfil } from './cuenta';
import { EditorPerro, Publicaciones } from './publicaciones';
import { Solicitudes } from './solicitudes';
import { Administracion } from './administracion';

@Component({
  imports: [RouterLink],
  template: `
    <section class="shell section">
      <h1>{{ titulo }}</h1>
      <p>{{ texto }}</p>
      <a class="button" [routerLink]="destino">{{ enlace }}</a>
    </section>
  `
})
class MensajePagina {
  private route = inject(ActivatedRoute).snapshot;
  readonly titulo = this.route.data['titulo'];
  readonly texto = this.route.data['texto'];
  readonly enlace = this.route.data['enlace'] ?? 'Volver al inicio';
  readonly destino = this.route.data['reintentar'] ? this.route.queryParamMap.get('volver') ?? '/cuenta' : '/';
}

const publicaciones = proteger('Rescatista', 'Administrador');
const administrador = proteger('Administrador');

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Catalogo, title: 'Adopta Patitas', data: { inicio: true } },
  { path: 'perros', component: Catalogo, title: 'Perros en adopción · Adopta Patitas' },
  { path: 'perros/:id', component: Detalle, title: 'Conoce al perro · Adopta Patitas' },
  { path: 'entrar', component: Acceso, title: 'Iniciar sesión · Adopta Patitas' },
  { path: 'registro', component: Acceso, title: 'Crear cuenta · Adopta Patitas', data: { registro: true } },
  { path: 'cuenta', canActivate: [proteger()], component: CuentaLayout, children: [
    { path: '', pathMatch: 'full', component: MiPerfil, title: 'Mi perfil · Adopta Patitas' },
    { path: 'solicitudes', canActivate: [proteger('Adoptante')], component: Solicitudes, title: 'Mis solicitudes · Adopta Patitas' },
    { path: 'recibidas', canActivate: [publicaciones], component: Solicitudes, title: 'Solicitudes recibidas · Adopta Patitas', data: { recibidas: true } },
    { path: 'publicaciones', canActivate: [publicaciones], component: Publicaciones, title: 'Mis publicaciones · Adopta Patitas' },
    { path: 'publicaciones/nueva', canActivate: [publicaciones], component: EditorPerro, title: 'Publicar un perro · Adopta Patitas' },
    { path: 'publicaciones/:id/editar', canActivate: [publicaciones], component: EditorPerro, title: 'Editar publicación · Adopta Patitas' },
    { path: 'perros', canActivate: [administrador], component: Publicaciones, title: 'Administrar perros · Adopta Patitas', data: { todas: true } },
    { path: 'usuarios', canActivate: [administrador], component: Administracion, title: 'Administrar usuarios · Adopta Patitas' }
  ] },
  { path: 'sin-acceso', component: MensajePagina, data: { titulo: 'Acceso restringido', texto: 'Tu cuenta no tiene permisos para esta página.' } },
  { path: 'sesion-no-disponible', component: MensajePagina, data: { titulo: 'No pudimos verificar tu sesión', texto: 'Comprueba tu conexión e intenta otra vez.', enlace: 'Reintentar', reintentar: true } },
  { path: '**', component: MensajePagina, data: { titulo: 'Página no encontrada', texto: 'Esta página ya no está disponible o la dirección cambió.' } }
];
