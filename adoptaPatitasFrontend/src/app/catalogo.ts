import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Perro, sexos, tamanos } from './api';
import { edad, etiquetaEstado, Feedback, Foto, Tarjeta, Vista } from './ui';

@Component({
  imports: [ReactiveFormsModule, RouterLink, Feedback, Foto, Tarjeta],
  template: `
    @if (inicio) {
      <section class="hero">
        <div class="shell hero-layout">
          <div class="hero-copy">
            <p class="eyebrow">Adopción responsable</p>
            <h1>Un hogar empieza con un <em>encuentro.</em></h1>
            <p>Conoce a los perros que esperan una familia. Si alguno te roba el corazón, puedes enviar una solicitud a quien lo cuida.</p>
            <a class="button" routerLink="/perros">Conocer a los perros</a>
          </div>
          @if (portada(); as perro) {
            <div class="hero-art">
              <app-foto [url]="perro.fotos[0]" [alt]="'Foto de ' + perro.nombre" />
            </div>
          }
        </div>
      </section>
    } @else {
      <section class="catalog-band" aria-labelledby="listado">
        <div class="shell">
          <h1 id="listado">Perros en adopción</h1>
          <form class="filters" [formGroup]="filtros" (ngSubmit)="consultar()">
            <label>Nombre, raza o descripción <input type="search" formControlName="busqueda"></label>
            <label>Tamaño <select formControlName="tamano"><option value="">Todos</option>@for (t of tamanos; track t) { <option>{{ t }}</option> }</select></label>
            <label>Sexo <select formControlName="sexo"><option value="">Todos</option>@for (s of sexos; track s) { <option>{{ s }}</option> }</select></label>
            <button [disabled]="cargando()">Buscar</button>
            <button class="secondary" type="button" [disabled]="cargando()" (click)="filtros.reset(); consultar()">Limpiar</button>
          </form>
        </div>
      </section>
    }
    <section class="shell section" [class.featured]="inicio" [class.catalog-results]="!inicio" aria-labelledby="listado">
      @if (inicio) {
        <div class="section-top">
          <h2 class="section-heading" id="listado">Perros que esperan hogar</h2>
          @if (perros().length) { <a class="ghost" routerLink="/perros">Ver todo el catálogo</a> }
        </div>
      }
      <app-feedback [cargando]="cargando()" [error]="error()" />
      @if (error()) { <button class="secondary" (click)="consultar()">Reintentar</button> }
      @else if (!cargando() && !perros().length) {
        <p class="notice">{{ inicio ? 'Por ahora no hay perros disponibles.' : 'No hay perros que coincidan con esta búsqueda.' }}</p>
      }
      <div class="cards">
        @for (perro of perros(); track perro.id) { <app-ficha [perro]="perro" /> }
      </div>
    </section>
  `
})
export class Catalogo extends Vista implements OnInit {
  readonly inicio = inject(ActivatedRoute).snapshot.data['inicio'] === true;
  readonly perros = signal<Perro[]>([]);
  readonly portada = computed(() => this.perros().find(perro => perro.fotos.length));
  readonly filtros = this.fb.group({ busqueda: '', tamano: '', sexo: '' });
  readonly tamanos = tamanos;
  readonly sexos = sexos;

  ngOnInit() { void this.consultar(); }
  consultar() {
    return this.cargar(async () => {
      const filtros = Object.fromEntries(Object.entries(this.filtros.getRawValue()).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
      const perros = await this.api.catalogo(filtros);
      this.perros.set(this.inicio ? perros.slice(0, 3) : perros);
    });
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, Feedback, Foto],
  template: `
    <section class="shell section">
      <a class="back-link" routerLink="/perros">← Perros en adopción</a>
      <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
      @if (error() && !perro()) { <button class="secondary" (click)="consultar()">Reintentar</button> }
      @if (perro(); as ficha) {
        <div class="detail">
          <div class="gallery">
            <app-foto [url]="ficha.fotos[indice()]" [alt]="'Foto de ' + ficha.nombre + ' (' + (indice() + 1) + ')'" />
            @if (ficha.fotos.length > 1) {
              <div class="actions" aria-label="Elegir foto">
                @for (foto of ficha.fotos; track $index) {
                  <button class="secondary photo-choice" [attr.aria-pressed]="indice() === $index" (click)="indice.set($index)">Foto {{ $index + 1 }}</button>
                }
              </div>
            }
          </div>
          <div>
            <p class="meta">{{ estado(ficha.estado) }}</p>
            <h1>{{ ficha.nombre }}</h1>
            <p>{{ edad(ficha.edadMeses) }} · {{ ficha.tamano }} · {{ ficha.sexo }} @if (ficha.raza) { · {{ ficha.raza }} }</p>
            <p class="long-text">{{ ficha.descripcion || 'Esta ficha aún no tiene descripción.' }}</p>
            @if (ficha.estado === 'Disponible') {
              @if (enviada() || yaSolicitada()) {
                <p>Ya enviaste una solicitud para este perro.</p><a routerLink="/cuenta/solicitudes">Ver mis solicitudes</a>
              } @else if (sesion.tiene('Adoptante') && sesion.usuario()?.id !== ficha.responsableId) {
                <form class="panel form" [formGroup]="solicitud" (ngSubmit)="enviar(ficha.id)">
                  <h2>Solicitar adopción</h2>
                  <label>Mensaje para quien cuida a {{ ficha.nombre }} (opcional)
                    <textarea formControlName="mensaje" rows="5" maxlength="2000"></textarea>
                  </label>
                  <button [disabled]="ocupado() || solicitud.invalid">Enviar solicitud</button>
                </form>
              } @else if (sesion.lista() && !sesion.usuario()) {
                <a class="button" routerLink="/entrar" [queryParams]="{ volver: '/perros/' + ficha.id }">Inicia sesión para solicitar adopción</a>
              }
            }
          </div>
        </div>
      }
    </section>
  `
})
export class Detalle extends Vista implements OnInit {
  private route = inject(ActivatedRoute);
  readonly perro = signal<Perro | null>(null);
  readonly indice = signal(0);
  readonly enviada = signal(false);
  readonly yaSolicitada = signal(false);

  constructor() {
    super();
    effect(limpiar => {
      const ficha = this.perro();
      if (!ficha || ficha.estado !== 'Disponible' || !this.sesion.tiene('Adoptante') ||
          this.sesion.usuario()?.id === ficha.responsableId) return;
      let activa = true;
      limpiar(() => activa = false);
      void this.api.historial().then(filas => {
        if (activa) this.yaSolicitada.set(filas.some(fila => fila.perroId === ficha.id));
      }).catch(() => {});
    });
  }
  readonly solicitud = this.fb.group({ mensaje: ['', Validators.maxLength(2000)] });
  readonly edad = edad;
  readonly estado = etiquetaEstado;

  ngOnInit() {
    void this.consultar();
  }
  consultar() {
    return this.cargar(async () => {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new HttpErrorResponse({ status: 404 });
      const ficha = await this.api.perro(id);
      if (ficha.id !== Number(this.route.snapshot.paramMap.get('id'))) return;
      this.perro.set(ficha);
      this.indice.set(0);
    });
  }
  enviar(id: number) {
    if (this.solicitud.invalid) return;
    void this.guardar(async () => {
      await this.api.solicitar(id, this.solicitud.controls.mensaje.value.trim() || null);
      if (this.perro()?.id === id) this.enviada.set(true);
    }, 'Tu solicitud se envió.');
  }
}


