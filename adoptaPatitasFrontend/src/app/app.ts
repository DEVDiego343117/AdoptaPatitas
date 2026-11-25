import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api, Sesion, mensajeError } from './api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html'
})
export class App {
  readonly sesion = inject(Sesion);
  private api = inject(Api);
  private router = inject(Router);
  readonly aviso = signal('');
  readonly saliendo = signal(false);

  constructor() { void this.sesion.recuperar().catch(() => {}); }

  async salir() {
    this.aviso.set('');
    this.saliendo.set(true);
    try {
      await this.api.logout();
      this.sesion.invalidar();
      await this.router.navigateByUrl('/');
    } catch (e) {
      if (!this.sesion.usuario()) await this.router.navigateByUrl('/');
      else this.aviso.set(mensajeError(e));
    } finally { this.saliendo.set(false); }
  }
}
