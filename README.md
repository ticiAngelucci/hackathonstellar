# Idea General
PatoPay es una app móvil que busca solucionar problemas a la hora de dividir gastos grupales. La idea principal es asignar un agente a cada usuario, capaz de cobrar y pagar a otros agentes, alivianando así la carga y proceso manual que usualmente termina en disputas o dinero perdido.
## Features principales
- Grupos por invitación para pagar
- Carga de saldo con staking
- Contribución a un fondo común por grupo con staking
- Pago de servicios automáticos (De acá sacamos porcentaje)
- Permisos de pago automático
- Abstracción web3
## Estética
Bien bostero, simple, que los usuarios no tengan que conocer de web3, cyber neon con acentos de boca, el pato como mascota principal
## Flujo de la app
<img width="2400" height="1500" alt="patopay-architecture" src="https://github.com/user-attachments/assets/34e3de71-43df-4905-94fd-4a9f31a32508" />
## Capa de cliente
La capa de cliente es la interfaz con la que interactúan los usuarios y sus agentes. La Web App, construida con Next.js y TypeScript, permite crear eventos, invitar participantes, registrar gastos, revisar balances y aprobar o rechazar solicitudes de pago. El Wallet / Agent Client representa a los agentes organizadores e invitados, y se encarga de aplicar las reglas configuradas por cada usuario y firmar las autorizaciones de pago. El usuario puede operar en modo manual, asistido o autónomo, dependiendo del nivel de control que quiera darle a su agente.
## PatoPay Core
PatoPay Core contiene la lógica principal del producto y funciona como la fuente de verdad del dominio. La AgentPay API, construida con Fast API, gestiona autenticación, usuarios, eventos, participantes, gastos, disputas, reglas y solicitudes de pago. Esta capa no debería delegar decisiones críticas a un modelo de lenguaje: debe validar permisos, estados y reglas de forma determinista. También coordina la comunicación entre el frontend, los agentes y el sistema de liquidación.
## Settlement Engine
El Settlement Engine calcula cuánto pagó cada persona, cuánto debería haber pagado y cuál es su balance final. También genera las transferencias necesarias y las optimiza para reducir la cantidad de pagos. Por ejemplo, en lugar de hacer varias transferencias cruzadas, puede determinar que dos personas paguen directamente a un tercero. Este componente debe trabajar con importes exactos, idealmente usando enteros o Decimal, y debe generar revisiones nuevas cuando se modifica una disputa o una participación.
## PostgreSQL
PostgreSQL almacena toda la información persistente de PatoPay: usuarios, eventos, gastos, participantes, balances, PaymentRequests, disputas, estados de settlement, hashes de pagos y receipts. También debe mantener un historial auditable de las revisiones. Si un usuario disputa un gasto, no conviene sobrescribir el settlement anterior; se debe crear una nueva revisión y marcar la anterior como obsoleta. La base de datos también será responsable de garantizar idempotencia para evitar que un mismo pago se procese dos veces.
## Payment Rail: x402 Gateway
El x402 Gateway conecta las solicitudes de pago de PatoPay con el protocolo x402. Cuando un Guest Agent intenta liquidar una deuda sin incluir un pago válido, el gateway responde con 402 Payment Required y describe el importe del activo, la red y el destinatario esperado. Luego recibe el PAYMENT-SIGNATURE firmado por el agente y comprueba que coincida con el PaymentRequest generado por PatoPay. x402 se utiliza aquí como mecanismo de autorización y transporte del pago, no como sistema para calcular gastos o resolver disputas.
## Facilitator
El facilitator verifica y liquida las autorizaciones recibidas desde el x402 Gateway. Primero valida que la red, el contrato del token, el importe, el destinatario, la expiración y la autorización Soroban sean correctos. Después envía o completa la operación en Stellar y devuelve el resultado del settlement. Para el MVP conviene utilizar un facilitator gestionado, ya que evita implementar desde cero la validación de XDR, la simulación de Soroban y la publicación de transacciones.
## Stellar
Stellar es la red blockchain donde se ejecutan las transferencias. En el MVP se utilizará stellar:testnet para probar el flujo sin fondos reales. La operación de pago se realizaría mediante Soroban y una autorización firmada por el agente, mientras que el facilitator puede encargarse de completar y enviar la transacción. Una vez confirmada, PatoPay guarda el transaction hash y actualiza el estado del settlement.
### USDC
USDC es el activo utilizado para representar los pagos entre participantes. En Stellar debe identificarse mediante el contrato correspondiente, no únicamente por el texto "USDC". Los importes deben manejarse en unidades base del token; por ejemplo, si el contrato utiliza siete decimales, 14.50 USDC se representa como 145000000 unidades base. Esto evita errores de redondeo y permite que el importe calculado por PatoPay coincida exactamente con el importe liquidado en la blockchain.
## Flujo de liquidación
El flujo comienza cuando el Settlement Engine genera un PaymentRequest después de finalizar el evento. El agente invitado revisa el desglose, aplica las reglas de su usuario y decide si debe aprobar, rechazar o disputar la solicitud. Si la aprueba, firma el pago y lo envía al x402 Gateway. El gateway y el facilitator verifican y liquidar la operación en Stellar; cuando reciben un resultado válido, PatoPay guarda el receipt, el transaction hash y marca el settlement como completado.

