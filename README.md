# Sistema de matrícula — IESTP Espinar

Interfaz web demostrativa para iniciar sesión, administrar matrículas y completar el proceso del estudiante del Instituto de Educación Superior Tecnológico Público de Espinar.

## Cómo abrirlo

No requiere instalar dependencias ni ejecutar un servidor.

1. Abre `index.html` en un navegador. Para la compatibilidad más completa con el almacenamiento y la creación de cuentas, usa Live Server en Visual Studio Code.
2. Ingresa con las credenciales de administrador indicadas abajo.
3. En **Matrículas**, selecciona **Nueva matrícula**. Registra los datos y asigna un usuario y contraseña al estudiante.
4. Entrega al postulante esas credenciales. En su portal completará teléfono y distrito, adjuntará los documentos de demostración, elegirá una carrera y enviará la solicitud.
5. En **Matrículas**, abre la solicitud enviada para revisar los datos y descargar los archivos. El administrador puede aprobarla o indicar qué debe corregir.
6. Si la solicitud queda observada, el postulante verá el motivo, actualizará sus datos o documentos y la reenviará. Al aprobarla, el portal actualiza el estado y habilita la boleta imprimible; en el diálogo de impresión se puede elegir **Guardar como PDF**.

## Funcionalidades de la interfaz

- **Inicio de sesión:** valida las credenciales del administrador y las cuentas de estudiantes creadas desde el panel; incluye opción para mostrar la contraseña.
- **Panel general:** resumen de postulantes, matrículas aprobadas, solicitudes pendientes y vacantes.
- **Matrículas:** creación de cuentas, asignación de credenciales, revisión de solicitudes, descarga de documentos, aprobación o solicitud de correcciones.
- **Estudiantes:** listado de ejemplo con búsqueda por nombre, DNI o código.
- **Carreras:** ocupación y vacantes disponibles por carrera.
- **Reportes:** resumen visual del periodo académico.
- **Configuración:** controles de demostración para el periodo, estado de matrícula y vacantes.
- **Portal del postulante:** edición de perfil, adjuntar documentos, reservar una vacante, seguimiento de observaciones, reenvío de solicitudes y boleta imprimible al aprobarse.
- **Menú adaptable:** en pantallas pequeñas se abre desde el botón de tres líneas y se cierra al elegir una sección, tocar fuera o presionar Esc.

## Archivos principales

| Archivo | Descripción |
| --- | --- |
| `index.html` | Contiene el inicio de sesión y las vistas administrativas y del estudiante. |
| `style.css` | Estilos y adaptación a pantallas móviles. |
| `js.js` | Validación local de credenciales, navegación y flujo de matrícula demostrativo. |
| `logo-iestp (1).png` | Logotipo del instituto. |

## Credenciales de demostración

- **Usuario:** `admin.demo`
- **Contraseña:** `Adm1n-Demo!2025`

## Alcance de la demostración

El inicio de sesión valida estas credenciales de demostración y las cuentas creadas por el administrador. Las cuentas y solicitudes se guardan en el almacenamiento local del navegador; los archivos se almacenan en IndexedDB. No se sincronizan entre equipos ni usuarios. Las contraseñas de estudiantes se guardan como hashes con sal, pero esto no reemplaza una autenticación segura del servidor.

Los nombres, cifras iniciales, requisitos de documentos, carreras y vacantes son ejemplos para demostrar el flujo; verifica los requisitos reales del instituto antes de usarlos. No cargues documentos ni datos personales reales. Antes de publicar el sistema, se debe conectar un backend con autenticación, permisos para administradores y postulantes, almacenamiento centralizado y validación de las operaciones. No uses las credenciales de demostración en producción.
