import { Component, input, output, OnInit, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { Rol, Usuario, roles } from './api';
import { Feedback, Vista } from './ui';

@Component({
  selector: 'app-permisos',
  imports: [ReactiveFormsModule],
  template: `
    <article class="panel">
      <h2>{{ persona().nombre }}</h2>
      <p>{{ persona().correo }} @if (persona().telefono) { · {{ persona().telefono }} }</p>
      <form [formGroup]="form" (ngSubmit)="guardar()">
        <fieldset>
          <legend>Roles</legend>
          @for (rol of roles; track rol) {
            <label class="check"><input type="checkbox" [formControlName]="rol"> {{ rol }}</label>
          }
        </fieldset>
        <label class="check"><input type="checkbox" formControlName="activo"> Cuenta activa</label>
        @if (!seleccion.length) { <p class="hint">Selecciona al menos un rol.</p> }
        <button [disabled]="ocupado() || !seleccion.length || form.pristine">Guardar permisos</button>
      </form>
    </article>
  `
})
export class Permisos implements OnInit {
  readonly persona = input.required<Usuario>();
  readonly ocupado = input(false);
  readonly cambios = output<Pick<Usuario, 'roles' | 'activo'>>();
  readonly roles = roles;
  readonly form = new FormRecord<FormControl<boolean>>({});
  ngOnInit() {
    for (const rol of roles) this.form.addControl(rol, new FormControl(this.persona().roles.includes(rol), { nonNullable: true }));
    this.form.addControl('activo', new FormControl(this.persona().activo, { nonNullable: true }));
  }
  get seleccion(): Rol[] { return roles.filter(rol => this.form.controls[rol]?.value); }
  guardar() {
    if (this.seleccion.length) this.cambios.emit({ roles: this.seleccion, activo: this.form.controls['activo'].value });
  }
}

@Component({
  imports: [Feedback, Permisos],
  template: `
    <h1>Administrar usuarios</h1>
    <app-feedback [cargando]="cargando()" [error]="error()" [aviso]="aviso()" />
    <button class="secondary" [disabled]="cargando() || ocupado()" (click)="consultar()">Actualizar</button>
    @if (!cargando() && !error() && !usuarios().length) { <p class="notice">No hay usuarios para mostrar.</p> }
    <div class="stack">
      @for (persona of usuarios(); track persona) {
        <app-permisos [persona]="persona" [ocupado]="ocupado() || cargando()" (cambios)="guardarPermisos(persona, $event)" />
      }
    </div>
  `
})
export class Administracion extends Vista {
  readonly usuarios = signal<Usuario[]>([]);
  ngOnInit() { void this.consultar(); }
  consultar() { return this.cargar(async () => this.usuarios.set(await this.api.usuarios())); }
  guardarPermisos(persona: Usuario, cambios: Pick<Usuario, 'roles' | 'activo'>) {
    const propios = persona.id === this.sesion.usuario()?.id;
    if ((propios || (persona.activo && !cambios.activo)) && !confirm('¿Cambiar el acceso de esta cuenta? Si cambias tus propios permisos, tendrás que volver a iniciar sesión.')) return;
    void this.guardar(async () => {
      await this.api.permisos(persona.id, cambios);
      this.usuarios.update(filas => filas.map(fila => fila.id === persona.id ? { ...fila, ...cambios } : fila));
      if (propios && (!cambios.activo || cambios.roles.length !== persona.roles.length ||
          cambios.roles.some(rol => !persona.roles.includes(rol)))) this.sesion.invalidar();
    }, 'Permisos actualizados.');
  }
}
