import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Api, Sesion, credenciales } from './api';

describe('Contrato de la API y sesión', () => {
  let api: Api;
  let sesion: Sesion;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([credenciales])), provideHttpClientTesting()]
    });
    api = TestBed.inject(Api);
    sesion = TestBed.inject(Sesion);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('recupera el perfil una sola vez con la cookie y aplica sus roles', async () => {
    const pendiente = sesion.recuperar();
    const dos = sesion.recuperar();
    const peticion = http.expectOne('/api/usuarios/mi-perfil');
    expect(peticion.request.withCredentials).toBeTrue();
    peticion.flush({ id: 7, nombre: 'Rosa', correo: 'rosa@example.test', telefono: null, roles: ['Rescatista'] });
    await Promise.all([pendiente, dos]);
    expect(sesion.tiene('Rescatista')).toBeTrue();
    expect(sesion.tiene('Administrador')).toBeFalse();
  });

  it('conserva acceso público si no existe una sesión', async () => {
    const pendiente = sesion.recuperar();
    http.expectOne('/api/usuarios/mi-perfil').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pendiente;
    expect(sesion.lista()).toBeTrue();
    expect(sesion.usuario()).toBeNull();
  });

  it('envía el archivo de una publicación bajo el campo multipart archivo', async () => {
    const foto = new File(['foto'], 'perro.png', { type: 'image/png' });
    const pendiente = api.subir(4, foto);
    const peticion = http.expectOne({ method: 'POST', url: '/api/perros/4/fotos' });
    expect(peticion.request.body.get('archivo')).toBe(foto);
    expect(peticion.request.headers.has('Content-Type')).toBeFalse();
    peticion.flush({ key: 'perros/4/a', url: 'https://example.test/a' });
    expect((await pendiente).key).toBe('perros/4/a');
  });
});
