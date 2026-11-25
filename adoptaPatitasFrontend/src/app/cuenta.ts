import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Feedback, Vista } from './ui';

@Component({
  imports: [ReactiveFormsModule, RouterLink, Feedback],
  template: `
    <section class="access-band">
      <div class="shell section narrow access-content">
      <h1>{{ registro ? 'Crear cuenta' : 'Iniciar sesión' }}</h1>
      <app-feedback [error]="error()" />
      <form class="panel form" [formGroup]="form" (ngSubmit)="enviar()">
        @if (registro) {
          <label>Nombre <input formControlName="nombre" autocomplete="name" maxlength="120" required></label>
        }
        <label>Correo <input type="email" formControlName="correo" autocomplete="email" [attr.maxlength]="registro ? 200 : null" required></label>
        @if (form.controls.correo.touched && form.controls.correo.invalid) { <small>Escribe un correo válido.</small> }
        <label>Contraseña
          <input type="password" formControlName="password" [attr.autocomplete]="registro ? 'new-password' : 'current-password'" required>
          @if (registro) { <small>Mínimo 8 caracteres.</small> }
        </label>
        @if (registro) {
          <label>Teléfono (opcional) <input type="tel" formControlName="telefono" maxlength="30" autocomplete="tel"></label>
          <label class="check"><input type="checkbox" formControlName="esRescatista"> Quiero publicar perros como rescatista</label>
        }
        @if (form.touched && form.invalid) { <p class="hint">Completa los campos obligatorios y revisa sus límites.</p> }
        <button [disabled]="ocupado()">{{ ocupado() ? 'Enviando…' : registro ? 'Crear cuenta' : 'Entrar' }}</button>
      </form>
      @if (registro) { <p class="access-switch">¿Ya tienes cuenta? <a routerLink="/entrar" queryParamsHandling="preserve">Inicia sesión</a>.</p> }
      @else { <p class="access-switch">¿Primera vez aquí? <a routerLink="/registro" queryParamsHandling="preserve">Crea una cuenta</a>.</p> }
      </div>
    </section>
  `
})
export class Acceso extends Vista {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly registro = this.route.snapshot.data['registro'] === true;
  private cuentaCreada = false;
  readonly form = this.fb.group({
    nombre: ['', this.registro ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)] : []],
    correo: ['', [Validators.required, Validators.email, ...(this.registro ? [Validators.maxLength(200)] : [])]],
    password: ['', this.registro ? [Validators.required, Validators.minLength(8)] : [Validators.required]],
    telefono: ['', Validators.maxLength(30)],
    esRescatista: false
  });

  enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    void this.guardar(async () => {
      const datos = this.form.getRawValue();
      const credenciales = { correo: datos.correo.trim(), password: datos.password };
      if (this.registro && !this.cuentaCreada) {
        await this.api.registro({ ...datos, ...credenciales, nombre: datos.nombre.trim(), telefono: datos.telefono.trim() || null });
        this.cuentaCreada = true;
      }
      await this.sesion.entrar(credenciales);
      const volver = this.route.snapshot.queryParamMap.get('volver');
      await this.router.navigateByUrl(volver && /^\/(perros\/\d+|cuenta(?:\/[\w/-]+)?)$/.test(volver) ? volver : '/cuenta');
    });
  }
}

@Component({
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="shell section account">
      <aside><nav class="account-nav" aria-label="Mi cuenta">
        <a routerLink="/cuenta">Mi perfil</a>
        @if (sesion.tiene('Adoptante')) { <a routerLink="/cuenta/solicitudes">Mis solicitudes</a> }
        @if (sesion.tiene('Rescatista', 'Administrador')) {
          <a routerLink="/cuenta/publicaciones">Mis publicaciones</a>
          <a routerLink="/cuenta/recibidas">Solicitudes recibidas</a>
        }
        @if (sesion.tiene('Administrador')) {
          <a routerLink="/cuenta/perros">Administrar perros</a>
          <a routerLink="/cuenta/usuarios">Administrar usuarios</a>
        }
      </nav></aside>
      <div class="account-content">
        @if (sesion.usuario()) { <router-outlet /> }
        @else { <h1>Sesión finalizada</h1><a routerLink="/entrar">Iniciar sesión</a> }
      </div>
    </div>
  `
})
export class CuentaLayout extends Vista {}

@Component({
  imports: [ReactiveFormsModule, Feedback],
  template: `
    <h1>Mi perfil</h1>
    <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
    @if (sesion.usuario(); as persona) {
      <p>{{ persona.correo }} · {{ persona.roles.join(', ') }}</p>
    }
    @if (listo) {
      <form class="panel form" [formGroup]="form" (ngSubmit)="enviar()">
        <label>Nombre <input formControlName="nombre" autocomplete="name" maxlength="120" required></label>
        <label>Teléfono (opcional) <input type="tel" formControlName="telefono" maxlength="30" autocomplete="tel"></label>
        @if (form.touched && form.invalid) { <small>Escribe un nombre y revisa los límites de los campos.</small> }
        <button [disabled]="ocupado()">Guardar perfil</button>
      </form>
    } @else if (error()) { <button class="secondary" (click)="consultar()">Reintentar</button> }
  `
})
export class MiPerfil extends Vista {
  listo = false;
  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    telefono: ['', Validators.maxLength(30)]
  });
  ngOnInit() { void this.consultar(); }
  consultar() {
    return this.cargar(async () => {
      const perfil = await this.api.perfil();
      this.sesion.usuario.set(perfil);
      this.form.reset({ nombre: perfil.nombre, telefono: perfil.telefono ?? '' });
      this.listo = true;
    });
  }
  enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    void this.guardar(async () => {
      const datos = this.form.getRawValue();
      const cambios = { nombre: datos.nombre.trim(), telefono: datos.telefono.trim() || null };
      await this.api.editarPerfil(cambios);
      this.sesion.usuario.update(persona => persona && { ...persona, ...cambios });
    }, 'Perfil actualizado.');
  }
}
