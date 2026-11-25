import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Decision, Solicitud, Recibida } from './api';
import { Feedback, Foto, Vista } from './ui';

@Component({
  imports: [Feedback, Foto, DatePipe],
  template: `
    <header class="page-tools">
      <h1>{{ recibidas ? 'Solicitudes recibidas' : 'Mis solicitudes' }}</h1>
      <button class="secondary" [disabled]="cargando() || ocupado()" (click)="consultar()">Actualizar</button>
    </header>
    <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
    @if (!cargando() && !error() && !filas().length) { <p class="notice">Todavía no hay solicitudes.</p> }
    <div class="stack">
      @for (fila of filas(); track fila.id) {
        <article class="panel request">
          <app-foto [url]="fila.fotos[0]" [alt]="'Foto de ' + fila.perro" />
          <div>
            <p class="request-meta"><span class="status-pill" [attr.data-status]="fila.estado">{{ fila.estado }}</span> {{ fila.fechaCreacion | date:'dd/MM/yyyy' }}</p>
            <h2>{{ fila.perro }}</h2>
            @if (contacto(fila); as persona) {
              <p>{{ persona.nombre }} · {{ persona.correo }} @if (persona.telefono) { · {{ persona.telefono }} }</p>
            }
            @if (fila.mensaje) { <p class="long-text">{{ fila.mensaje }}</p> }
            @if (recibidas && fila.estado === 'Pendiente') {
              <div class="actions">
                <button [disabled]="ocupado() || cargando()" (click)="decidir(fila, 'Aprobada')">Aprobar</button>
                <button class="secondary" [disabled]="ocupado() || cargando()" (click)="decidir(fila, 'Rechazada')">Rechazar</button>
              </div>
            }
          </div>
        </article>
      }
    </div>
  `
})
export class Solicitudes extends Vista {
  readonly recibidas = inject(ActivatedRoute).snapshot.data['recibidas'] === true;
  readonly filas = signal<(Solicitud | Recibida)[]>([]);
  ngOnInit() { void this.consultar(); }
  private async actualizar() {
    this.filas.set(await (this.recibidas ? this.api.recibidas() : this.api.historial()));
  }
  consultar() { return this.cargar(() => this.actualizar()); }
  contacto(fila: Solicitud | Recibida) { return 'adoptante' in fila ? fila.adoptante : null; }
  decidir(fila: Solicitud, estado: Decision) {
    const texto = estado === 'Aprobada'
      ? '¿Aprobar esta solicitud? El perro quedará como adoptado y las demás solicitudes pendientes se rechazarán.'
      : '¿Rechazar esta solicitud?';
    if (!confirm(texto)) return;
    void this.guardar(async () => {
      await this.api.decidir(fila.id, estado);
      this.filas.update(filas => filas.map(item => {
        if (item.id === fila.id) return { ...item, estado };
        if (estado === 'Aprobada' && item.perroId === fila.perroId && item.estado === 'Pendiente') {
          return { ...item, estado: 'Rechazada' };
        }
        return item;
      }));
    }, 'Solicitud actualizada.');
  }
}
