# ☕ Stellar Chill Café

Un taller para descubrir Stellar construyendo una cafetería comunitaria. Cada participante modifica y despliega su propio contrato, crea recetas desde la página y compra las de otras personas con XLM de prueba. El frontend es común; la personalidad de cada café vive en su contrato y sus creaciones.

**Todo el taller se realiza en Stellar Testnet. No se utilizan fondos reales ni datos simulados.**

**[Empezar el taller: SPEC.md](SPEC.md)** · [Hacer fork](https://github.com/Gabrululu/Chill-Coffee/fork)

Después del fork, abre **Code → Codespaces → Create codespace en tu repositorio**. Así podrás guardar y publicar tus soluciones en tu propia cuenta.

La página del evento está en **https://chill-cafe.mintedinpe.workers.dev/**. El fork incluye su registro público, pero desplegar tu contrato no lo publica automáticamente: entrega el manifiesto a quien facilita para que lo revise y apruebe. Para un evento independiente o para practicar sin depender de esa aprobación, coordina la creación de un registro propio con quien facilita.

## Una introducción al ecosistema Stellar

[Stellar](https://stellar.org/) es una red abierta orientada a mover valor: permite crear cuentas, transferir activos e interactuar con aplicaciones financieras. Su activo nativo es **XLM**, utilizado para comisiones y requisitos de reserva de la red. La [documentación de fundamentos](https://developers.stellar.org/docs/learn/fundamentals) es un buen punto de partida.

**Soroban** es la plataforma de contratos inteligentes de Stellar. Puedes escribir lógica en Rust, compilarla a WebAssembly y desplegarla en la red. La wallet firma las operaciones y la red ejecuta el contrato con las autorizaciones correspondientes. Empieza por la [introducción oficial a contratos](https://developers.stellar.org/docs/build/smart-contracts/overview).

**Testnet** es una red separada para aprender y probar. Friendbot entrega XLM de prueba; esos fondos no tienen valor real. Las mismas herramientas permiten aprender sobre cuentas, firmas, contratos, pagos y exploradores antes de trabajar con otras redes.

## ¿Qué busca este proyecto?

Aprender con una experiencia compartida y visible: **crear → registrar → descubrir → pedir → servir → ver el ranking**.

Cada persona hace fork, cambia una regla pequeña de `CafeMenu` en su IDE, prueba y despliega su contrato. Quien facilita revisa el resultado y lo publica en un `CafeRegistry` común. Desde la página, los asistentes registran bebidas o postres, se compran entre sí y ven los pedidos del evento.

Las recetas registradas, órdenes, pagos, estados y directorio están on-chain. La interfaz, sus ilustraciones y la generación opcional con IA se ejecutan fuera de la cadena; una receta generada se publica cuando se firma su registro. Sin proveedor de IA configurado, se puede escribir la receta a mano.

## Glosario

| Término | Significado en este taller |
|---|---|
| Stellar | La red donde se registran y ejecutan las operaciones. |
| XLM / lumen | Activo nativo; aquí usamos exclusivamente XLM de Testnet. |
| Stroop | Unidad mínima de XLM: 1 XLM = 10.000.000 stroops. Los contratos utilizan enteros. |
| Testnet | Red de pruebas independiente de Mainnet; puede reiniciarse. |
| Mainnet | Red pública donde los activos pueden tener valor real. No se usa en este taller. |
| Soroban | Plataforma de contratos inteligentes de Stellar. |
| Contrato inteligente | Programa desplegado on-chain que aplica reglas y conserva estado. |
| WASM / WebAssembly | Formato al que se compila el contrato Rust para ejecutarlo en Soroban. |
| Wallet | Herramienta que administra cuentas y solicita tu autorización para firmar. |
| Freighter | Wallet utilizada para conectar el navegador y firmar las acciones del café. |
| Dirección pública `G…` | Identifica una cuenta. Se puede compartir para recibir fondos de prueba. |
| Dirección de contrato `C…` | Identifica un contrato desplegado. Es pública. |
| Clave privada `S…` | Secreto que permite firmar por una cuenta. No se comparte. |
| Frase de recuperación | Palabras que permiten recuperar una wallet; deben guardarse en privado. |
| Identidad CLI | Nombre local que Stellar CLI asocia a una cuenta; no es su clave privada. |
| Passphrase de red | Identificador público que vincula una firma a una red concreta. No es la frase de recuperación. |
| Transacción | Conjunto de operaciones firmado y enviado a Stellar. |
| Firma / autorización | Prueba de que una cuenta permite ejecutar una acción. `require_auth()` la exige en el contrato. |
| Ledger | Registro cerrado de la red que incluye transacciones y cambios de estado. |
| Hash | Identificador calculado de una transacción o archivo; sirve para localizarla o verificar su contenido. |
| RPC | API usada por el SDK para leer contratos, simular y enviar transacciones. |
| Horizon | API de consultas de Stellar; el taller también la usa para saldos y recuperación de confirmaciones. |
| Friendbot | Servicio que financia cuentas Testnet con XLM de prueba. |
| SAC | Stellar Asset Contract: interfaz que permite usar un activo Stellar desde contratos Soroban. Aquí transfiere XLM. |
| Evento | Registro emitido por un contrato, por ejemplo al pedir o servir una bebida. |
| Simulación | Previsualización de una llamada real antes de firmarla; no confirma ni publica la transacción. |
| ABI / interfaz | Funciones y tipos públicos que deben coincidir entre contrato y frontend. |
| TTL | Tiempo de vida del almacenamiento; los datos pueden necesitar extensión o restauración. |
| Registro de cafés | Contrato compartido que contiene las direcciones y hashes aprobados del evento. |

## Recursos útiles

- [skills.stellar.org](https://skills.stellar.org/) — recursos oficiales para aprender patrones de Stellar y dar contexto a asistentes de IA. Recomendado antes de empezar si eres nuevo/a; las skills comunitarias se identifican por separado.
- [stellar.org](https://stellar.org/) — sitio oficial de la red Stellar.
- [developers.stellar.org](https://developers.stellar.org/) — documentación técnica de Stellar y Soroban.
- [Stellar Raven](https://raven.stellar.org/) — servidor MCP del ecosistema para consultar documentación, recursos y contexto desde asistentes de IA. [Repositorio](https://github.com/stellar-experimental/stellar-raven).
- [Stellar Laboratory](https://lab.stellar.org/) — herramienta oficial para construir y enviar transacciones a mano, explorar cuentas y consultar Testnet. [Guía](https://developers.stellar.org/docs/tools/lab).
- [Freighter](https://www.freighter.app/) — extensión de wallet necesaria para firmar desde el frontend. [Crear wallet](https://help.freighter.app/article/debwabbw3h-get-started-with-freighter) · [Importar una existente](https://help.freighter.app/article/iev57sxvkc-import-an-existing-wallet).
- [Friendbot](https://friendbot.stellar.org/) — grifo de fondos Testnet. [Explicación oficial](https://developers.stellar.org/docs/learn/fundamentals/networks#friendbot).
- [Stellar Expert — Testnet](https://stellar.expert/explorer/testnet) — explorador del ecosistema para consultar cuentas, contratos y transacciones de prueba.
- [Instalar Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) — instalación y alternativas por sistema operativo.

## Estructura

```text
contracts/
  cafe_menu/          # Tu café: se modifica, prueba y despliega
  cafe_registry/      # Directorio compartido: lo despliega quien facilita
frontend/             # Next.js + React + TypeScript; conecta con Freighter
scripts/              # Desplegar, financiar, exportar y aprobar cafés
workshop/             # Parche opcional para el primer reto de contrato
.devcontainer/        # Node, pnpm, Rust y Stellar CLI para Codespaces
SPEC.md               # Paso a paso de la actividad
```

El taller utiliza pagos XLM entre participantes. Su estructura corresponde a una cafetería con `CafeMenu` y `CafeRegistry`; el ejercicio no requiere crear un token ni un pool de intercambio.

## Empezar

Con Codespaces, abre el repositorio y espera a que termine la preparación. La página se inicia en el puerto 3000. Freighter se instala en tu navegador local; no dentro del contenedor.

En tu equipo, instala las herramientas de [SPEC.md](SPEC.md#2-instalación-local), clona tu fork y ejecuta:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
cp .env.example frontend/.env.local
pnpm dev
```

Necesitas Node **22.12 o superior**; el contenedor usa Node **24**, pnpm **12.3.4**, Rust **1.91.1** y Stellar CLI **28.1.0**. Continúa con [SPEC.md](SPEC.md) para crear la wallet, obtener fondos, modificar tu contrato y compartir tu café.
