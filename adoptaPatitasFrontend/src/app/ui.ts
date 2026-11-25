import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { Api, Sesion, Perro, mensajeError } from './api';

export abstract class Vista {
  protected api = inject(Api);
  protected fb = inject(FormBuilder).nonNullable;
  readonly sesion = inject(Sesion);
  readonly ocupado = signal(false);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  async cargar(accion: () => Promise<void>) {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    try { await accion(); }
    catch (e) { this.error.set(mensajeError(e)); }
    finally { this.cargando.set(false); }
  }

  async guardar(accion: () => Promise<void>, aviso = '') {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      await accion();
      this.aviso.set(aviso);
    } catch (e) { this.error.set(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

export const edad = (meses: number) => {
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return [anios ? anios + (anios === 1 ? ' año' : ' años') : '',
    resto || !anios ? resto + (resto === 1 ? ' mes' : ' meses') : ''].filter(Boolean).join(' y ');
};
export const etiquetaEstado = (estado: string) => estado === 'NoDisponible' ? 'No disponible' : estado;

@Component({
  selector: 'app-foto',
  template: `
    <div class="photo">
      @if (url() && fallo() !== url()) {
        <img [src]="url()" [alt]="alt()" loading="lazy" (error)="fallo.set(url())">
      } @else { <div class="photo-empty"><small>Sin foto disponible</small></div> }
    </div>
  `
})
export class Foto {
  readonly url = input<string>();
  readonly alt = input.required<string>();
  readonly fallo = signal<string | undefined>(undefined);
}

@Component({
  selector: 'app-ficha',
  imports: [Foto, RouterLink],
  template: `
    <article class="card">
      <app-foto [url]="perro().fotos[0]" [alt]="'Foto de ' + perro().nombre" />
      <div class="card-copy">
        <p class="meta">{{ perro().tamano }} · {{ perro().sexo }}</p>
        <h3><a [routerLink]="['/perros', perro().id]">{{ perro().nombre }}</a></h3>
        <p>{{ edad(perro().edadMeses) }} @if (perro().raza) { · {{ perro().raza }} }</p>
        <ng-content />
      </div>
    </article>
  `
})
export class Tarjeta {
  readonly perro = input.required<Perro>();
  readonly edad = edad;
}

@Component({
  selector: 'app-feedback',
  template: `
    @if (cargando()) { <p class="notice" role="status">Cargando…</p> }
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    @if (aviso()) { <p class="notice" role="status">{{ aviso() }}</p> }
  `
})
export class Feedback {
  readonly cargando = input(false);
  readonly error = input('');
  readonly aviso = input('');
}

