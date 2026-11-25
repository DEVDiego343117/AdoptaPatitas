import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Ficha, Perro, estados, sexos, tamanos } from './api';
import { etiquetaEstado, Feedback, Foto, Tarjeta, Vista } from './ui';

@Component({
  imports: [Feedback, RouterLink, Tarjeta],
  template: `
    <header class="page-tools">
      <h1>{{ todas ? 'Administrar perros' : 'Mis publicaciones' }}</h1>
      <div class="actions">
        <a class="button" routerLink="/cuenta/publicaciones/nueva">Publicar un perro</a>
        <button class="secondary" [disabled]="cargando()" (click)="consultar()">Actualizar</button>
      </div>
    </header>
    <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
    @if (!cargando() && !error() && !perros().length) { <p class="notice">Todavía no hay publicaciones.</p> }
    <div class="cards">
      @for (perro of perros(); track perro.id) {
        <app-ficha [perro]="perro">
          <p><span class="status-pill" [attr.data-status]="perro.estado">{{ estado(perro.estado) }}</span></p>
          <a class="ghost card-action" [routerLink]="['/cuenta/publicaciones', perro.id, 'editar']">Editar publicación</a>
        </app-ficha>
      }
    </div>
  `
})
export class Publicaciones extends Vista {
  readonly todas = inject(ActivatedRoute).snapshot.data['todas'] === true;
  readonly perros = signal<Perro[]>([]);
  readonly estado = etiquetaEstado;
  ngOnInit() {
    if (history.state.eliminada) this.aviso.set('Publicación eliminada.');
    void this.consultar();
  }
  consultar() { return this.cargar(async () => this.perros.set(await this.api.publicaciones(this.todas))); }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, Feedback, Foto],
  template: `
    <a class="back-link" [routerLink]="volver()">← Volver a publicaciones</a>
    <h1>{{ id ? 'Editar publicación' : 'Publicar un perro' }}</h1>
    <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
    @if (id && !perro() && error()) { <button class="secondary" (click)="consultar()">Reintentar</button> }
    @if (!id || perro()) {
      <form class="panel form" [formGroup]="form" (ngSubmit)="enviar()">
        <label>Nombre <input formControlName="nombre" maxlength="100" required></label>
        <label>Edad en meses <input type="number" formControlName="edadMeses" min="0" max="360" step="1" required></label>
        <div class="form-row">
          <label>Tamaño <select formControlName="tamano">@for (t of tamanos; track t) { <option>{{ t }}</option> }</select></label>
          <label>Sexo <select formControlName="sexo">@for (s of sexos; track s) { <option>{{ s }}</option> }</select></label>
          <label>Estado <select formControlName="estado">@for (s of estados; track s) { <option [value]="s">{{ etiqueta(s) }}</option> }</select></label>
        </div>
        <label>Raza (opcional) <input formControlName="raza" maxlength="100"></label>
        <label>Descripción (opcional) <textarea formControlName="descripcion" maxlength="4000" rows="5"></textarea></label>
        @if (!id) {
          <label>Fotos (opcional) <input type="file" multiple accept="image/jpeg,image/png,image/webp" (change)="elegir($event)"></label>
          <small>JPEG, PNG o WebP. Hasta 5 MB por foto.</small>
          @if (archivos().length) { <p>{{ archivos().length }} foto(s) seleccionada(s).</p> }
        }
        @if (form.touched && form.invalid) { <p class="hint">Revisa el nombre y la edad. Usa un número entero entre 0 y 360 meses.</p> }
        <button [disabled]="ocupado() || cargando() || (!id && !!errorFoto())">{{ ocupado() ? 'Procesando…' : id ? 'Guardar cambios' : 'Publicar' }}</button>
      </form>
      @if (perro(); as ficha) {
        <section class="panel form">
          <h2>Fotos de {{ ficha.nombre }}</h2>
          <div class="cards">
            @for (foto of ficha.fotos; track $index) {
              <div class="photo-tools">
                <app-foto [url]="foto" [alt]="'Foto ' + ($index + 1) + ' de ' + ficha.nombre" />
                <button class="secondary" [disabled]="ocupado() || cargando()" (click)="quitar($index)">Eliminar foto {{ $index + 1 }}</button>
              </div>
            } @empty { <p>Aún no hay fotos.</p> }
          </div>
          <label>Añadir una foto <input #archivo type="file" accept="image/jpeg,image/png,image/webp" (change)="elegir($event)" [disabled]="ocupado()"></label>
          <small>JPEG, PNG o WebP. Hasta 5 MB.</small>
          <div class="actions">
            <button [disabled]="ocupado() || cargando() || !archivos().length || !!errorFoto()" (click)="subir(archivo)">Subir foto</button>
            @if (ficha.fotos.length) {
              <button class="secondary" [disabled]="ocupado() || cargando()" (click)="renovar()">Actualizar fotos</button>
            }
          </div>
        </section>
        <section class="panel">
          <h2>Eliminar publicación</h2>
          <p>Para eliminarla, debe estar sin fotos y sin solicitudes. Si tiene solicitudes, puedes cambiar su estado para sacarla del catálogo.</p>
          <button class="danger" [disabled]="ocupado() || cargando() || !!ficha.fotos.length" (click)="borrar()">Eliminar publicación</button>
        </section>
      }
      @if (errorFoto()) { <p class="error" role="alert">{{ errorFoto() }}</p> }
    }
  `
})
export class EditorPerro extends Vista {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly id = this.route.snapshot.paramMap.has('id') ? Number(this.route.snapshot.paramMap.get('id')) || -1 : 0;
  readonly perro = signal<Perro | null>(null);
  readonly archivos = signal<File[]>([]);
  readonly errorFoto = signal('');
  readonly tamanos = tamanos;
  readonly sexos = sexos;
  readonly estados = estados;
  readonly etiqueta = etiquetaEstado;
  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    edadMeses: [0, [Validators.required, Validators.min(0), Validators.max(360), Validators.pattern(/^\d+$/)]],
    tamano: this.fb.control<Ficha['tamano']>('Mediano'),
    sexo: this.fb.control<Ficha['sexo']>('Macho'),
    estado: this.fb.control<Ficha['estado']>('Disponible'),
    raza: ['', Validators.maxLength(100)],
    descripcion: ['', Validators.maxLength(4000)]
  });

  ngOnInit() {
    if (history.state.creada) this.aviso.set('Publicación creada.');
    if (this.id) void this.consultar();
  }
  volver() {
    const ficha = this.perro();
    return ficha && ficha.responsableId !== this.sesion.usuario()?.id && this.sesion.tiene('Administrador')
      ? '/cuenta/perros' : '/cuenta/publicaciones';
  }
  consultar() {
    return this.cargar(async () => {
      const ficha = await this.api.perro(this.id);
      if (ficha.responsableId !== this.sesion.usuario()?.id && !this.sesion.tiene('Administrador')) {
        this.error.set('Solo puedes editar tus propias publicaciones.');
        return;
      }
      this.perro.set(ficha);
      this.form.reset({ ...ficha, raza: ficha.raza ?? '', descripcion: ficha.descripcion ?? '' });
    });
  }
  elegir(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    const invalido = archivos.some(foto => foto.size < 1 || foto.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(foto.type));
    this.errorFoto.set(invalido ? 'Usa fotos JPEG, PNG o WebP de hasta 5 MB cada una.' : '');
    this.archivos.set(invalido ? [] : archivos);
  }
  enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid || (!this.id && this.errorFoto()) || this.cargando()) return;
    const valores = this.form.getRawValue();
    const datos: Ficha = { ...valores, nombre: valores.nombre.trim(), raza: valores.raza.trim() || null,
      descripcion: valores.descripcion.trim() || null };
    void this.guardar(async () => {
      if (this.id) {
        await this.api.editar(this.id, datos);
        this.perro.update(ficha => ficha && { ...ficha, ...datos });
        this.form.markAsPristine();
      } else {
        const ficha = await this.api.crear(datos, this.archivos());
        await this.router.navigate(['/cuenta/publicaciones', ficha.id, 'editar'], { state: { creada: true } });
      }
    }, 'Publicación guardada.');
  }
  subir(input: HTMLInputElement) {
    const archivo = this.archivos()[0];
    if (!archivo || this.errorFoto()) return;
    void this.guardar(async () => {
      const foto = await this.api.subir(this.id, archivo);
      this.perro.update(ficha => ficha && { ...ficha, fotos: [...ficha.fotos, foto.url] });
      this.archivos.set([]);
      input.value = '';
    }, 'Foto añadida.');
  }
  quitar(indice: number) {
    if (!confirm('¿Eliminar esta foto?')) return;
    void this.guardar(async () => {
      await this.api.quitarFoto(this.id, indice);
      this.perro.update(ficha => ficha && { ...ficha, fotos: ficha.fotos.filter((_, i) => i !== indice) });
    }, 'Foto eliminada.');
  }
  renovar() {
    return this.cargar(async () => {
      const ficha = await this.api.perro(this.id);
      this.perro.update(actual => actual && { ...actual, fotos: ficha.fotos });
    });
  }
  borrar() {
    if (this.perro()?.fotos.length || !confirm('¿Eliminar esta publicación definitivamente?')) return;
    void this.guardar(async () => {
      await this.api.borrar(this.id);
      await this.router.navigateByUrl(this.volver(), { state: { eliminada: true } });
    });
  }
}


