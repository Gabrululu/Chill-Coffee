# Taller: tu propio Stellar Chill Café

Esta guía te lleva de un fork a un café propio en Stellar Testnet. El diseño del frontend es común: cada persona modifica y despliega `CafeMenu`; quien facilita publica los contratos revisados en un `CafeRegistry` compartido. Las recetas se crean desde la página y los pagos son XLM de prueba reales en Testnet.

## 1. Qué vas a entregar

- Un cambio pequeño en `contracts/cafe_menu/src/lib.rs`, con sus pruebas.
- Tu contrato desplegado y un manifiesto público de tu café.
- Una receta registrada desde `/create`.
- Un pedido a otra persona y una orden servida desde `/barista`.

Lee primero la [introducción y el glosario](README.md). Consulta [Stellar Skills](https://skills.stellar.org/), [Raven](https://raven.stellar.org/) y la [documentación oficial](https://developers.stellar.org/) durante el ejercicio.

### Ruta recomendada si es tu primer contrato

1. Prepara el entorno con Codespaces (abajo) o con la instalación local (apartados 2 y 3).
2. Crea y financia las dos cuentas del apartado 4: una en Freighter y otra en CLI.
3. Modifica y prueba `CafeMenu` siguiendo los apartados 5 y 6.
4. Compila, despliega y verifica el resultado en el apartado 7.
5. Exporta el manifiesto y entrégalo a quien facilita (apartado 8). Tras su aprobación podrás usar tu café desde la página.

Ejecuta los comandos en la terminal, desde la raíz del proyecto: la carpeta que contiene `package.json`, `Cargo.toml` y este archivo. Copia solo el contenido de los bloques de comandos. Sustituye los marcadores `TU_…` por tus datos antes de ejecutar. Los apartados de exportación de wallet y registro por CLI son opcionales.

### Opción rápida: GitHub Codespaces

Haz fork del repositorio en GitHub. En **tu fork**, abre **Code → Codespaces → Create codespace**. También puedes abrirlo en VS Code con Dev Containers y Docker.

El contenedor instala Node 24, pnpm 12.3.4, Rust 1.91.1 con `wasm32v1-none` y Stellar CLI 28.1.0. Después instala las dependencias, compila los dos contratos, crea los archivos de entorno si faltan e inicia el frontend en el puerto 3000. La primera preparación descarga herramientas y puede tardar varios minutos. No crea identidades ni envía transacciones.

Abre el puerto 3000 desde **Ports**. Instala Freighter en tu navegador local y usa esa misma ventana para abrir el frontend. La wallet no se instala dentro del contenedor. Si no se inicia la página, ejecuta `pnpm dev`; el registro de inicio está en `/tmp/stellar-chill-cafe-dev.log`. Si cambias la configuración del contenedor, usa **Codespaces: Rebuild Container**.

Con el entorno preparado, continúa en el apartado 4.

## 2. Instalación local

Necesitas estas cinco herramientas:

| Herramienta | Para qué sirve | Instalación oficial |
|---|---|---|
| Git | Clonar tu fork y revisar tus cambios. | [git-scm.com](https://git-scm.com/downloads) |
| Node.js 24 y pnpm | Ejecutar el frontend y los scripts TypeScript. | [Node.js](https://nodejs.org/en/download) · [pnpm](https://pnpm.io/installation) |
| Rust + `wasm32v1-none` | Compilar contratos a WebAssembly. | [rustup](https://rustup.rs/) |
| Stellar CLI | Crear identidades, desplegar e interactuar con Testnet. | [Instalar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) |
| Freighter | Firmar las operaciones del navegador. | [Freighter](https://www.freighter.app/) |

Usamos Node 24 para que todos tengan el mismo entorno. No uses Node 18. Rust se fija mediante `rust-toolchain.toml`; pnpm mediante `package.json`.

### Windows

Recomendamos [WSL2 con Ubuntu](https://learn.microsoft.com/windows/wsl/install) para ejecutar los comandos Bash del taller. Desde PowerShell como administrador ejecuta `wsl --install`, reinicia si se solicita y abre Ubuntu. Sigue allí los pasos Linux y guarda el proyecto en tu directorio Linux. Freighter se instala en el navegador de Windows.

Esta recomendación unifica el entorno del taller; Stellar CLI también documenta opciones nativas para Windows.

### Linux / WSL2 (Ubuntu o Debian)

```bash
sudo apt update
sudo apt install -y git build-essential pkg-config libssl-dev curl ca-certificates
```

Instala Node con [nvm](https://github.com/nvm-sh/nvm#installing-and-updating), siguiendo su instalador oficial; abre una terminal nueva y ejecuta:

```bash
nvm install 24
nvm use 24
npm install --global pnpm@12.3.4
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install 1.91.1 --profile minimal --component rustfmt,clippy,rust-analyzer
rustup target add wasm32v1-none --toolchain 1.91.1
cargo install --locked stellar-cli --version 28.1.0 --no-default-features
```

Compilar la CLI puede tardar varios minutos. La guía oficial de instalación ofrece binarios precompilados como alternativa. No necesitas Corepack para estos pasos: pnpm se instala directamente con npm.

### macOS

Instala [Homebrew](https://brew.sh/) si aún no lo tienes:

```bash
brew install git node@24
```

Sigue la indicación que imprime Homebrew para añadir Node 24 al `PATH`. Después:

```bash
npm install --global pnpm@12.3.4
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install 1.91.1 --profile minimal --component rustfmt,clippy,rust-analyzer
rustup target add wasm32v1-none --toolchain 1.91.1
cargo install --locked stellar-cli --version 28.1.0 --no-default-features
```

### Verificar herramientas

```bash
git --version
node --version
pnpm --version
rustc +1.91.1 --version
stellar --version
```

Si un comando no aparece, abre otra terminal o recarga `~/.bashrc` / `~/.zshrc`. El contenedor ya incluye estas herramientas.

## 3. Clonar y abrir la página

Primero crea un fork con el botón **Fork** del repositorio en GitHub. Sustituye `TU_USUARIO` por tu cuenta de GitHub:

```bash
git clone https://github.com/TU_USUARIO/Chill-Coffee.git
cd Chill-Coffee
pnpm install --frozen-lockfile
cp .env.example .env
cp .env.example frontend/.env.local
pnpm dev
```

Deja esa terminal ejecutando `pnpm dev` y abre `http://localhost:3000`. Para los siguientes comandos abre una **segunda terminal** en la raíz del proyecto; en Codespaces puedes hacerlo con **Terminal → New Terminal**. Si prefieres detener la página, pulsa `Ctrl+C` y vuelve a iniciarla más tarde con `pnpm dev`.

Copia los archivos de entorno solo la primera vez; no sobrescribas tu configuración al repetir el ejercicio. Codespaces ya realiza esta preparación.

## 4. Crear, financiar y respaldar la wallet

### Freighter para usar la página

Instala [Freighter](https://www.freighter.app/) desde su sitio oficial. Sigue la [guía de creación](https://help.freighter.app/article/debwabbw3h-get-started-with-freighter) para crear una wallet exclusiva del taller, guarda su frase de recuperación en privado y establece una contraseña. En la configuración de red selecciona **Testnet**. La passphrase pública de la red es:

```text
Test SDF Network ; September 2015
```

Copia tu dirección pública `G…`. Conecta la extensión a la página y acepta la autorización. Utiliza **Get Testnet XLM** cuando esté disponible, o visita [Friendbot](https://friendbot.stellar.org/) añadiendo tu dirección:

```text
https://friendbot.stellar.org/?addr=TU_DIRECCION_G
```

Reemplaza el marcador por la dirección completa. Verifica el saldo en Freighter o en [Stellar Expert Testnet](https://stellar.expert/explorer/testnet). Friendbot financia cuentas de prueba; no debe usarse como recarga repetitiva de una cuenta ya financiada.

### Identidad CLI para desplegar

El camino recomendado utiliza dos cuentas: Freighter firma recetas y pedidos; una identidad nueva de CLI despliega el contrato. Ambas necesitan XLM de Testnet.

En el archivo raíz `.env`, conserva el nombre de identidad y añade **tu dirección pública de Freighter** como barista:

```dotenv
STELLAR_IDENTITY=chill-cafe-testnet
STELLAR_BARISTA_ADDRESS=TU_DIRECCION_G_DE_FREIGHTER
```

El segundo valor debe ser una dirección válida completa, no el texto del ejemplo. Quita el `#` inicial de `STELLAR_BARISTA_ADDRESS` si editas la línea comentada de `.env.example`. Guarda el archivo. Los scripts leen `.env` de la raíz; no basta con editar `frontend/.env.local`.

Crea y financia la identidad:

```bash
pnpm fund:wallet --create
stellar keys address chill-cafe-testnet
```

El script verifica Testnet antes de financiar y no reemplaza una identidad existente. Si ya existe, usa `pnpm fund:wallet`. Las identidades se almacenan fuera del repositorio; `.env` contiene el **nombre**, nunca la clave privada. No es necesario importar tu wallet del navegador a Codespaces.

Al terminar debes ver `Testnet account available: G…` o `Account already available: G…`. La dirección que imprime `stellar keys address` corresponde a la cuenta CLI y normalmente será distinta de la de Freighter. La cuenta CLI paga el despliegue; `STELLAR_BARISTA_ADDRESS` permite a tu wallet del navegador servir pedidos. Si cambias `STELLAR_IDENTITY`, usa ese mismo nombre en los comandos `stellar keys …`.

### Importar una cuenta existente al CLI (opcional)

Si necesitas que el CLI firme con la misma cuenta de Freighter, por ejemplo para administrar el registro del evento, importa una cuenta exclusiva de Testnet con este alias:

```bash
stellar keys add chill-cafe-owner --secret-key
```

Introduce la clave secreta `S…` de esa cuenta **solo cuando la terminal la solicite**. No la añadas al comando, a `.env`, al repositorio, a chats ni a capturas. Esta opción del CLI importa una cuenta existente; no crea otra wallet.

Comprueba la dirección pública importada:

```bash
stellar keys address chill-cafe-owner
```

Debe coincidir con la dirección `G…` de la cuenta elegida en Freighter. Para usarla con los scripts del proyecto, configura en el `.env` raíz:

```dotenv
STELLAR_IDENTITY=chill-cafe-owner
```

El alias puede ser distinto; mantenlo consistente entre la importación, la verificación y `.env`. Importar una cuenta no le concede permisos nuevos: para administrar un registro existente, su dirección debe coincidir con el administrador on-chain. Conserva un respaldo privado de la cuenta fuera de Codespaces; recrear un alias no recupera una clave perdida.

### Exportar o recuperar una wallet (opcional)

Para compartir tu café exporta **direcciones públicas y el manifiesto**, nunca secretos. Guarda el respaldo de Freighter según su [ayuda oficial](https://help.freighter.app/); la contraseña de la extensión no sustituye la frase de recuperación.

Si quieres usar en Freighter la cuenta nueva creada por CLI, puedes obtener su frase ejecutando **en privado**, fuera de sesiones grabadas:

```bash
stellar keys secret chill-cafe-testnet --phrase
```

Este comando muestra un secreto. No lo pegues en archivos del repo, chats, capturas ni variables `NEXT_PUBLIC_*`. Sigue [Import an existing wallet](https://help.freighter.app/article/iev57sxvkc-import-an-existing-wallet) en un perfil de Freighter preparado para importar esa frase. Compara su dirección con `stellar keys address chill-cafe-testnet` y selecciona Testnet. Si decides usar esta cuenta como barista, actualiza `STELLAR_BARISTA_ADDRESS` antes de desplegar.

En Codespaces, cualquiera con acceso al entorno puede acceder a los archivos de identidad. Utiliza únicamente cuentas nuevas de taller; seleccionar Testnet no protege los secretos de una wallet personal utilizada en otras redes.

## 5. Entender qué vas a editar

```text
contracts/cafe_menu/src/lib.rs     Reglas de tu cafetería
contracts/cafe_menu/src/test.rs    Pruebas de esas reglas
contracts/cafe_registry/          Directorio administrado por quien facilita
frontend/                        Página compartida Next.js + React + TypeScript
frontend/config/my_item.json      Receta opcional para registrar desde CLI
scripts/                         Operaciones de despliegue y publicación
```

`CafeMenu` conserva recetas y órdenes, exige autorizaciones y transfiere XLM del comprador al creador mediante el Stellar Asset Contract nativo. El pago y la orden ocurren en la misma transacción; si falla una parte, se revierte la operación. El contador aumenta al pedir y una orden servida no puede procesarse otra vez.

`CafeRegistry` permite al administrador publicar los contratos revisados. El frontend descubre esos cafés y verifica su código e interfaz antes de usarlos. Desplegar un contrato por sí solo no lo añade al evento.

Conserva las funciones, argumentos y tipos públicos de la interfaz `cafe-v1`, las autorizaciones, el activo XLM y las protecciones de repetición. Modificar esa interfaz requiere coordinar un cambio del frontend con quien facilita. No cambies `cafe_registry` para el ejercicio individual.

## 6. Primer reto: emitir un agradecimiento

Empieza con un cambio pequeño que mantiene precios y pagos. Lee `register_item`, `order_item` y `mark_served` en `contracts/cafe_menu/src/lib.rs`.

Puedes hacerlo en el IDE: junto a los otros eventos de `lib.rs`, añade:

```rust
#[contractevent]
pub struct ThanksForOrdering {
    #[topic]
    pub item_id: u64,
    pub order_id: u64,
}
```

Dentro de `order_item`, después de publicar `ItemOrdered` y antes de `Ok(order)`, publica también:

```rust
ThanksForOrdering {
    item_id,
    order_id: id,
}
.publish(&env);
```

Actualiza la prueba de eventos en `src/test.rs` para esperar ambos eventos, conservando las comprobaciones de pago y autorización. [workshop/thank-you.patch](workshop/thank-you.patch) muestra el cambio completo, incluida esa prueba.

Si prefieres aplicar ese mismo cambio automáticamente **en lugar de editarlo a mano**, inspecciona y aplica el parche:

```bash
git apply --check workshop/thank-you.patch
git apply workshop/thank-you.patch
cargo fmt --all
pnpm contract:check
pnpm contract:test
pnpm contract:build
```

No apliques el parche dos veces. Si ya modificaste esas líneas y no aplica, incorpora los cambios manualmente desde [workshop/thank-you.patch](workshop/thank-you.patch). Puedes personalizar el nombre del nuevo evento y adaptar su prueba. No renombres los eventos existentes que consume la aplicación.

Si editaste a mano, ejecuta también `cargo fmt --all`, `pnpm contract:check`, `pnpm contract:test` y `pnpm contract:build` desde la raíz. Continúa solo si todos terminan sin errores. El archivo compilado de tu café queda en `target/wasm32v1-none/release/cafe_menu.wasm`; ese es el WASM que se enviará a Stellar.

Antes de desplegar, las pruebas deben cubrir registro, consulta, pago, contador, servicio, precios inválidos, autorización y propinas. No suprimas pruebas para ocultar un fallo.

Como reto posterior puedes crear un descuento Happy Hour dentro de `order_item`: calcula con enteros el importe final y utiliza el mismo importe en la transferencia, la orden y el evento. Actualiza las expectativas y prueba redondeo, límites y reversión de pagos. Un descuento por cantidad requeriría cambiar la interfaz actual y coordinar el frontend; no forma parte del camino básico.

## 7. Desplegar tu contrato

Antes de continuar, comprueba que:

- Estás en la raíz del proyecto y las verificaciones del apartado 6 terminaron sin errores.
- La identidad CLI existe y está financiada en Testnet.
- Guardaste en `.env` el nombre de esa identidad y la dirección pública completa de Freighter como barista.

Ejecuta estos comandos uno por uno; espera a que termine la compilación antes de desplegar:

```bash
pnpm contract:build
pnpm contract:deploy
```

El script utiliza tu identidad CLI para firmar y pagar las comisiones en XLM de prueba, comprueba la red, despliega el WASM e inicializa el contrato con el barista configurado y el SAC nativo de XLM. No solicita una firma en Freighter.

**Cómo reconocer un despliegue correcto:**

1. La terminal muestra `✓ Deployment confirmed and read back from Testnet.` (o `✓ Existing deployment verified.` si ya estaba confirmado). Mostrar solo `Contract: C…` no demuestra que se haya desplegado: esa dirección se calcula antes de enviar la operación.
2. Abre `deployments/testnet.local.json`: `status` debe ser `confirmed`. Guarda `contract_id` (dirección `C…`) y `wasm_sha256` (hash del código); son datos públicos y no son el hash de una transacción.
3. Abre el enlace de Stellar Expert que imprime el primer despliegue, o visita `https://stellar.expert/explorer/testnet/contract/TU_CONTRATO_C` sustituyendo el marcador. Comprueba que la dirección coincide con `contract_id`. El script ya contrasta el hash del código y la configuración con Testnet; el explorador puede tardar en reflejarlo.

No necesitas ejecutar otro comando de inicialización. El contrato ya está desplegado, pero aparecerá en el evento después de completar el apartado 8.

Referencia: [despliegue en Testnet con Stellar CLI, documentación oficial](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet).

El plan local está en `deployments/testnet.local.json`. Si la confirmación es incierta, no borres el plan ni repitas un despliegue a ciegas:

```bash
pnpm contract:deploy --verify
```

`--verify` consulta el contrato y su configuración; no envía un despliegue. Conserva el mismo WASM, identidad y barista mientras resuelves una confirmación pendiente. Si falla por conexión o porque aún no se encuentra el contrato, ese fallo por sí solo no demuestra que la transacción haya sido rechazada: espera, revisa el error y consulta con quien facilita antes de volver a enviar.

Repetir un despliegue confirmado verifica el contrato existente. Para desplegar deliberadamente otra versión, primero resuelve toda transacción pendiente, conserva el plan confirmado con otro nombre terminado en `.local.json` y vuelve a ejecutar el despliegue. El contrato anterior y sus recetas siguen existiendo; un nuevo contrato empieza con otro estado.

## 8. Compartir tu café con el evento

El manifiesto es un archivo JSON con la dirección y el hash del contrato que quien facilita necesita para incorporarlo al directorio. Después de confirmar el despliegue, expórtalo usando tu dirección pública de Freighter como propietario:

```bash
pnpm cafe:export --name "Mi Café Lunar" --owner TU_DIRECCION_G_DE_FREIGHTER
```

Reemplaza el marcador por tu dirección. Se genera `deployments/my-cafe.local.json` después de comprobar el contrato y su WASM. Comparte **ese JSON público**, el código modificado y los resultados de las pruebas con quien facilita. No compartas `.env` ni archivos de identidad.

Si necesitas regenerarlo después de revisar los cambios, usa `--force`. El manifiesto identifica el contrato y su hash; no basta con cambiar el nombre del café.

Quien facilita revisa y aprueba el manifiesto en el registro del evento. Cuando termine, abre `/cafes` en el frontend compartido y selecciona tu café. El directorio se sincroniza periódicamente; puedes volver a consultarlo sin desplegar otra página. Un enlace con `?cafe=TU_CONTRATO_C` selecciona ese contrato cuando está aprobado.

Tu frontend local debe apuntar al mismo registro que el evento. Copia los **tres valores públicos** que entregue la facilitación tanto en `.env` como en `frontend/.env.local`:

```dotenv
CAFE_REGISTRY_CONTRACT_ID=CONTRATO_C_DEL_REGISTRO
CAFE_REGISTRY_WASM_HASH=HASH_HEXADECIMAL_DEL_REGISTRO
CAFE_REGISTRY_ADMIN=DIRECCION_G_DEL_ADMIN
```

Sustituye todos los marcadores y reinicia `pnpm dev`. Si no defines estos valores, se utiliza el registro público incluido en el repositorio; puede estar vacío y no debe confundirse con el registro de tu evento.

## 9. Crear, pedir y servir desde la página

1. En `/cafes`, elige tu café aprobado y conecta Freighter en Testnet.
2. Abre `/create`. Escribe tu receta o utiliza AI Barista si el servidor tiene proveedor configurado. Revisa nombre, categoría, ingredientes, estilo y precio antes de firmar.
3. Registra el item. La firma publica la receta en tu contrato; espera confirmación y revisa el hash. No necesitas escribir la receta en una terminal.
4. En `/menu`, elige el café de otra persona, revisa precio y creador y firma el pedido. XLM se transfiere al creador de esa receta.
5. En `/barista`, la cuenta del creador o el barista configurado puede marcar su orden como servida. Una wallet diferente no obtiene ese permiso por visitar la página.
6. Observa `/live` y `/leaderboard`. La sincronización consulta el estado on-chain sin polling agresivo; un breve retraso no significa que debas repetir el pago.

AI Barista es opcional. Si la generación no está disponible, escribe la receta manualmente; puedes completar todos los pasos de la actividad de esa forma.

### Alternativa opcional: registrar por CLI

Edita `frontend/config/my_item.json` con datos propios, por ejemplo:

```json
{
  "name": "Affogato Lunar",
  "category": "dessert",
  "ingredients": ["Helado de lúcuma", "Espresso"],
  "vibe": "Lofi peruano",
  "price_xlm": 3,
  "description": "Un pequeño descanso entre estrellas."
}
```

Las categorías son `coffee`, `dessert`, `cold` y `experimental`. Usa un precio entre 1 y 5 XLM con hasta 7 decimales y entre 1 y 8 ingredientes. Los límites de texto se miden en bytes UTF-8: nombre 60, estilo 80, descripción 240 y cada ingrediente 60; las tildes pueden ocupar más de un byte. No se permiten textos vacíos ni caracteres de control. Valida y registra contra tu contrato:

```bash
pnpm register:item --contract TU_CONTRATO_C --dry-run
pnpm register:item --contract TU_CONTRATO_C
```

Aquí firma la identidad CLI y esa cuenta queda como creadora; puede ser distinta de Freighter. El script guarda un diario para evitar registros duplicados. Ante una confirmación pendiente usa `pnpm register:item --check` antes de intentar otra escritura.

## 10. Comandos de referencia

| Comando | Uso |
|---|---|
| `pnpm dev` | Página en desarrollo, puerto 3000. |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificaciones TypeScript. |
| `pnpm contract:check` | Formato y Clippy de Rust. |
| `pnpm contract:test` | Pruebas de los contratos. |
| `pnpm contract:build` | Compilar WASM de ambos contratos. |
| `pnpm fund:wallet --create` | Crear y financiar una identidad CLI nueva. |
| `pnpm contract:deploy` | Desplegar tu café en Testnet. |
| `pnpm cafe:export --name "Mi café" --owner G…` | Exportar el manifiesto público. |
| `pnpm register:item --contract C…` | Registrar el JSON con la identidad CLI. |

Desplegar contratos, registrar recetas y realizar pedidos envía transacciones a Testnet. Para abrir la página basta con `pnpm dev`; las acciones de la actividad utilizan datos on-chain.

## 11. Problemas comunes y recuperación

| Síntoma | Qué comprobar |
|---|---|
| No aparece mi café | Debe estar aprobado en el mismo registro del frontend; confirma con quien facilita. |
| No puedo servir | Conecta la cuenta creadora de la receta o el barista definido al desplegar. |
| Freighter indica otra red | Cambia a Testnet en la extensión y vuelve a conectar. |
| Saldo insuficiente | Comprueba la dirección que firma: Freighter y CLI pueden ser cuentas distintas. |
| Firma rechazada | Revisa si cancelaste en Freighter; vuelve a intentar solo si no se envió una transacción. |
| Confirmación incierta | Guarda el hash, consulta Stellar Expert Testnet y usa la recuperación indicada por la página/script. No vuelvas a pagar para comprobar. |
| RPC no disponible | Una wallet conectada no garantiza acceso al RPC desde tu servidor. Revisa conectividad y estado de Testnet; espera y reconsulta. |
| Contrato incompatible o hash diferente | Reconstruye y exporta el manifiesto correcto; facilita una nueva revisión. No desactives la validación. |
| Error de compilación | Comprueba Rust 1.91.1, target `wasm32v1-none`, Stellar CLI 28.1.0 y dependencias bloqueadas. |
| La IA no genera | Escribe la receta manualmente para continuar. |

Red del taller: RPC `https://soroban-testnet.stellar.org/`, Horizon `https://horizon-testnet.stellar.org`. El transporte SDK incluye un RPC alternativo verificado para lecturas; los comandos CLI de despliegue usan el RPC principal. Una caída de ese servicio puede impedir desplegar aunque Freighter funcione. No cambies a Mainnet para solucionar una caída de Testnet.

Para reiniciar el frontend, detén el proceso con Ctrl+C y ejecuta `pnpm dev`. Recargar el navegador no borra datos on-chain. Conserva los planes y recibos `*.local.json` hasta resolver sus transacciones. Si Testnet se reinicia o el almacenamiento del contrato expira, coordina con la facilitación la restauración o nuevos despliegues y manifiestos; no se recupera estado borrado con datos simulados.

Has terminado cuando otra persona puede descubrir tu café, pedir tu receta y ver esa orden servida, con las transacciones verificables en Testnet.
