# Adopta Patitas · frontend

Frontend Angular 20 en español para la API de adopciones del repositorio. Usa Angular Router, formularios reactivos y HttpClient.

## Desarrollo local

Requisitos: Node 20.19+, 22.12+ o 24.x compatible con Angular 20, npm, .NET 10 y PostgreSQL. R2 es necesario para cargar, servir y eliminar fotos. Configura PostgreSQL y R2 según el README y el archivo de ejemplo de la API. No incluyas credenciales en el frontend.

1. En adoptaPatitasApi, aplica las migraciones de AdopcionesDbContext y ejecuta dotnet run --launch-profile http. La API debe escuchar en http://localhost:5063.
2. En adoptaPatitasFrontend ejecuta npm ci y luego npm start.
3. Abre http://localhost:51749.

Angular envía todas las rutas /api al destino de proxy.conf.json. Cambia target si tu API escucha en otro puerto. Todas las peticiones de API incluyen credenciales y la cookie HttpOnly permanece en el navegador. El proxy permite usar un solo origen con SameSite=Strict; una configuración CORS que permite credenciales por sí sola no permite enviar esta cookie entre sitios diferentes.

Para producción, sirve la compilación con HTTPS, redirige /api al backend desde el mismo origen y sirve index.html para las rutas de Angular que no corresponden a recursos estáticos. La base relativa se define en src/app/api.ts.

## Validación

- npm run build compila la aplicación de producción.
- npm test -- --watch=false --browsers=ChromeHeadless ejecuta las pruebas con Chrome instalado. Si no lo detecta, establece CHROME_BIN con la ruta de Chrome.
- Comprueba el catálogo sin sesión, registro e inicio de sesión, restauración al recargar y edición del perfil.
- Usa cuentas de prueba distintas para publicar un perro, solicitar su adopción, revisar y resolver la solicitud. Comprueba que la aprobación cambia el perro a Adoptado.
- Con una cuenta Administrador, verifica la gestión de usuarios, permisos y publicaciones. Un cambio de roles o la desactivación invalida la cookie anterior en el servidor.
- Añade y elimina fotos con R2 configurado. Las URLs firmadas caducan a los 15 minutos. Actualiza la ficha o el listado para renovarlas.

La API impide duplicar solicitudes, solicitar la propia publicación y borrar perros con fotos o historial de solicitudes. Las fotos son JPEG, PNG o WebP de hasta 5 MB por archivo.
