export type Lang = 'en' | 'es';

export interface ChatAnswer {
  en: string;
  es: string;
}

export interface ChatQuestion {
  id: string;
  label: ChatAnswer;
  answer: ChatAnswer;
  followups?: string[];
}

export interface ChatCategory {
  id: string;
  label: ChatAnswer;
  questions: ChatQuestion[];
}

export interface PageScript {
  welcome: ChatAnswer;
  categories: ChatCategory[];
}

export type PageKey =
  | 'dashboard'
  | 'projects'
  | 'project-info'
  | 'project-pricing'
  | 'project-analytics'
  | 'project-history'
  | 'project-management'
  | 'prices'
  | 'products'
  | 'templates'
  | 'settings';

export const SCRIPTS: Record<PageKey, PageScript> = {
  dashboard: {
    welcome: {
      en: 'Hi! I can help you understand the dashboard and navigate the system. What would you like to know?',
      es: '¡Hola! Puedo ayudarte a entender el panel y navegar el sistema. ¿Qué necesitas saber?',
    },
    categories: [
      {
        id: 'dashboard-analytics',
        label: { en: 'Dashboard & Analytics', es: 'Panel y Analíticas' },
        questions: [
          {
            id: 'dash-what-shows',
            label: { en: 'What does the dashboard show?', es: '¿Qué muestra el panel?' },
            answer: {
              en: 'The dashboard shows:\n• Total projects by status (Pending, Estimating, Sent, Awarded, Lost, etc.)\n• Total pipeline value and won value\n• Conversion rate (% of projects that became Awarded)\n• Monthly trends for the last 6 months\n• Project type breakdown with win rates\n• Top cabinet SKUs most frequently quoted\n• Most used box materials, door materials, and hardware',
              es: 'El panel muestra:\n• Total de proyectos por estado (Pendiente, Estimando, Enviado, Ganado, Perdido, etc.)\n• Valor total del pipeline y valor ganado\n• Tasa de conversión (% de proyectos que se convirtieron en Ganados)\n• Tendencias mensuales de los últimos 6 meses\n• Desglose por tipo de proyecto con tasas de ganancia\n• SKUs de gabinetes más cotizados\n• Materiales de caja, puertas y herrajes más usados',
            },
          },
          {
            id: 'dash-won',
            label: { en: 'How are "won" projects counted?', es: '¿Cómo se cuentan los proyectos "ganados"?' },
            answer: {
              en: 'Only projects with status "Awarded" count as won. Projects with status "Lost", "Disqualified", or "Cancelled" are excluded from won totals. The conversion rate is calculated as: (Awarded projects ÷ Total projects) × 100.',
              es: 'Solo los proyectos con estado "Ganado" (Awarded) cuentan como ganados. Los proyectos con estado "Perdido", "Descalificado" o "Cancelado" quedan excluidos. La tasa de conversión se calcula como: (Proyectos Ganados ÷ Total de proyectos) × 100.',
            },
          },
          {
            id: 'dash-refresh',
            label: { en: 'How often does the dashboard update?', es: '¿Cada cuánto se actualiza el panel?' },
            answer: {
              en: 'The dashboard auto-refreshes every 30 seconds. It also refreshes automatically when you switch back to the browser tab after being away.',
              es: 'El panel se actualiza automáticamente cada 30 segundos. También se refresca cuando vuelves a la pestaña del navegador después de haber estado en otra.',
            },
          },
        ],
      },
      {
        id: 'navigation',
        label: { en: 'Navigation', es: 'Navegación' },
        questions: [
          {
            id: 'nav-sections',
            label: { en: 'What sections does the app have?', es: '¿Qué secciones tiene la aplicación?' },
            answer: {
              en: 'The app has 6 main sections in the left sidebar:\n• Dashboard — analytics and pipeline overview\n• Projects — list of all projects\n• Products Catalog — cabinet SKU database\n• Price List — materials, hardware, and accessories pricing\n• Templates — saved cabinet configurations\n• Settings — labor costs, waste %, exchange rate, team members',
              es: 'La app tiene 6 secciones principales en la barra lateral izquierda:\n• Panel (Dashboard) — analíticas y resumen del pipeline\n• Proyectos — lista de todos los proyectos\n• Catálogo de Productos — base de datos de SKUs de gabinetes\n• Lista de Precios — precios de materiales, herrajes y accesorios\n• Plantillas — configuraciones guardadas de gabinetes\n• Configuración — costos de mano de obra, % de desperdicio, tipo de cambio, equipo',
            },
          },
          {
            id: 'nav-project-detail',
            label: { en: 'How do I open a project?', es: '¿Cómo abro un proyecto?' },
            answer: {
              en: 'Go to the Projects section from the sidebar. Find your project in the list and click on it. This opens the Project Details workspace where you can add areas, cabinets, and configure pricing.',
              es: 'Ve a la sección Proyectos desde la barra lateral. Encuentra tu proyecto en la lista y haz clic en él. Esto abre el espacio de trabajo de Detalles del Proyecto donde puedes agregar áreas, gabinetes y configurar precios.',
            },
          },
        ],
      },
    ],
  },

  projects: {
    welcome: {
      en: 'Hi! I can help you with managing projects — creating, organizing, and understanding statuses. What do you need?',
      es: '¡Hola! Puedo ayudarte a gestionar proyectos — crear, organizar y entender los estados. ¿Qué necesitas?',
    },
    categories: [
      {
        id: 'projects-create',
        label: { en: 'Creating Projects', es: 'Crear Proyectos' },
        questions: [
          {
            id: 'proj-create',
            label: { en: 'How do I create a new project?', es: '¿Cómo creo un nuevo proyecto?' },
            answer: {
              en: 'To create a new project:\n1. Click the "New Project" button (top right of the Projects page)\n2. Fill in: project name, customer name, address, project type, and quote date\n3. Click Save — the project starts with "Pending" status\n\nYou can then open the project to add areas and cabinets.',
              es: 'Para crear un nuevo proyecto:\n1. Haz clic en el botón "Nuevo Proyecto" (parte superior derecha de la página de Proyectos)\n2. Completa: nombre del proyecto, nombre del cliente, dirección, tipo de proyecto y fecha de cotización\n3. Haz clic en Guardar — el proyecto inicia con estado "Pendiente"\n\nLuego puedes abrir el proyecto para agregar áreas y gabinetes.',
            },
            followups: ['proj-types', 'proj-status'],
          },
          {
            id: 'proj-types',
            label: { en: 'What project types are available?', es: '¿Qué tipos de proyecto existen?' },
            answer: {
              en: 'The default project types are:\n• Custom — fully custom millwork design\n• Bids — competitive bid/tender\n• Prefab — pre-fabricated cabinet lines\n• Stores — commercial/retail store fixtures\n\nAdditional custom types can be added in Settings → Custom Types.',
              es: 'Los tipos de proyecto predeterminados son:\n• Custom — diseño de millwork totalmente personalizado\n• Bids — concurso/licitación competitiva\n• Prefab — líneas de gabinetes prefabricados\n• Stores — mobiliario para tiendas comerciales\n\nPuedes agregar tipos adicionales en Configuración → Tipos Personalizados.',
            },
          },
          {
            id: 'proj-duplicate',
            label: { en: 'How do I duplicate a project?', es: '¿Cómo duplico un proyecto?' },
            answer: {
              en: 'On the Projects list, find the project and click the three-dot menu (⋯) → "Duplicate Project". This copies all areas, cabinets, items, and settings into a new project. The duplicate starts with the same name plus "(Copy)".',
              es: 'En la lista de Proyectos, encuentra el proyecto y haz clic en el menú de tres puntos (⋯) → "Duplicar Proyecto". Esto copia todas las áreas, gabinetes, ítems y configuraciones en un nuevo proyecto. El duplicado comienza con el mismo nombre más "(Copia)".',
            },
          },
          {
            id: 'proj-import',
            label: { en: 'How do I import or export a project?', es: '¿Cómo importo o exporto un proyecto?' },
            answer: {
              en: 'Export: Open the project in Project Details, use the export button to save a JSON backup file.\n\nImport: On the Projects page, click "Import Project" and upload a previously exported JSON file. The system will recreate the full project including all areas and cabinets.',
              es: 'Exportar: Abre el proyecto en Detalles del Proyecto y usa el botón de exportar para guardar un archivo de respaldo JSON.\n\nImportar: En la página de Proyectos, haz clic en "Importar Proyecto" y sube un archivo JSON exportado previamente. El sistema recreará el proyecto completo con todas sus áreas y gabinetes.',
            },
          },
          {
            id: 'proj-json-workflow',
            label: {
              en: 'How do I use JSON export to create a versioned backup?',
              es: '¿Cómo uso la exportación JSON para crear un respaldo versionado?',
            },
            answer: {
              en: 'JSON export is the manual versioning tool. Use it to save a snapshot at any point in the project lifecycle.\n\nTo export: open the project → floating action bar (☰) → JSON. Save the file with a meaningful name, e.g., "Patel_Residence_v2_approved.json".\n\nTo reimport — two scenarios:\n\n• As a NEW project: Go to Projects page → Import Project → upload the JSON. The system creates a fresh project with all areas and cabinets. Use this to start a similar project from a strong baseline.\n\n• To restore a previous state: import the JSON as a new project and work from that copy. For automatic restores, use the History tab inside the project instead.\n\nBest practice: export a JSON after every major client revision (v1 initial, v2 after first feedback, v3 approved).',
              es: 'La exportación JSON es la herramienta de versionado manual. Úsala para guardar una instantánea en cualquier punto del ciclo de vida del proyecto.\n\nPara exportar: abre el proyecto → barra de acción flotante (☰) → JSON. Guarda el archivo con un nombre descriptivo, ej: "Patel_Residence_v2_aprobado.json".\n\nPara reimportar — dos escenarios:\n\n• Como NUEVO proyecto: Ve a la página de Proyectos → Importar Proyecto → sube el JSON. El sistema crea un proyecto nuevo con todas las áreas y gabinetes. Úsalo para iniciar un proyecto similar desde una base sólida.\n\n• Para restaurar un estado anterior: importa el JSON como nuevo proyecto y trabaja desde esa copia. Para restauraciones automáticas, usa la pestaña Historial dentro del proyecto.\n\nMejor práctica: exporta un JSON después de cada revisión mayor del cliente (v1 inicial, v2 tras el primer feedback, v3 aprobado).',
            },
          },
        ],
      },
      {
        id: 'projects-status',
        label: { en: 'Project Statuses', es: 'Estados de Proyecto' },
        questions: [
          {
            id: 'proj-status',
            label: { en: 'What do the project statuses mean?', es: '¿Qué significan los estados de proyecto?' },
            answer: {
              en: 'The workflow progression is:\n• Pending — just created, not yet being worked on\n• Estimating — actively being designed/quoted\n• Sent — quote has been sent to the customer\n• Awarded — customer approved (counts as "won" in analytics)\n• Lost — customer chose another vendor\n• Disqualified — removed from active pipeline\n• Cancelled — cancelled by your company\n\nTo change status: open the project and click the status dropdown in the header.',
              es: 'La progresión del flujo de trabajo es:\n• Pendiente — recién creado, aún no se trabaja en él\n• Estimando — se está diseñando/cotizando activamente\n• Enviado — la cotización fue enviada al cliente\n• Ganado (Awarded) — el cliente aprobó (cuenta como "ganado" en analíticas)\n• Perdido — el cliente eligió a otro proveedor\n• Descalificado — retirado del pipeline activo\n• Cancelado — cancelado por tu empresa\n\nPara cambiar el estado: abre el proyecto y haz clic en el menú desplegable de estado en el encabezado.',
            },
          },
        ],
      },
      {
        id: 'projects-organize',
        label: { en: 'Organizing Projects', es: 'Organizar Proyectos' },
        questions: [
          {
            id: 'proj-groups',
            label: { en: 'How do I group related projects?', es: '¿Cómo agrupo proyectos relacionados?' },
            answer: {
              en: 'When editing a project\'s details, you can assign it to a group. Projects in the same group appear as a collapsible card in the Projects list, showing the combined value and cabinet count. This is useful when the same customer has multiple related quotes (e.g., different phases of a remodel or multiple units in a building).',
              es: 'Al editar los detalles de un proyecto, puedes asignarlo a un grupo. Los proyectos en el mismo grupo aparecen como una tarjeta colapsable en la lista de Proyectos, mostrando el valor combinado y la cantidad de gabinetes. Esto es útil cuando el mismo cliente tiene múltiples cotizaciones relacionadas.',
            },
          },
          {
            id: 'proj-search',
            label: { en: 'How do I search for a project?', es: '¿Cómo busco un proyecto?' },
            answer: {
              en: 'On the Projects page, use the search bar at the top to find projects by name, customer name, or address. You can also filter by status using the status filter buttons.',
              es: 'En la página de Proyectos, usa la barra de búsqueda en la parte superior para encontrar proyectos por nombre, nombre de cliente o dirección. También puedes filtrar por estado usando los botones de filtro de estado.',
            },
          },
        ],
      },
    ],
  },

  'project-info': {
    welcome: {
      en: 'You\'re on the Info tab. Here you configure additional costs, profit margin, tariff, taxes, and what appears on the PDF quote. What do you need help with?',
      es: 'Estás en la pestaña Info. Aquí configuras costos adicionales, margen de ganancia, arancel, impuestos y lo que aparece en la cotización PDF. ¿En qué necesitas ayuda?',
    },
    categories: [
      {
        id: 'info-project-details',
        label: { en: 'Editing Project Details', es: 'Editar Detalles del Proyecto' },
        questions: [
          {
            id: 'info-edit-header',
            label: {
              en: 'How do I change the project name, client, or address?',
              es: '¿Cómo cambio el nombre del proyecto, cliente o dirección?',
            },
            answer: {
              en: 'In the project header (visible at the top of any project tab), click the "Edit" link next to the project name. This opens the project details form where you can update:\n• Project name\n• Customer name\n• Address\n• Project type (Custom, Bids, Prefab, etc.)\n• Quote date\n\nClick Save to apply changes. These fields appear on the PDF quote.',
              es: 'En el encabezado del proyecto (visible en la parte superior de cualquier pestaña), haz clic en el enlace "Editar" junto al nombre del proyecto. Esto abre el formulario de detalles donde puedes actualizar:\n• Nombre del proyecto\n• Nombre del cliente\n• Dirección\n• Tipo de proyecto (Custom, Bids, Prefab, etc.)\n• Fecha de cotización\n\nHaz clic en Guardar para aplicar los cambios. Estos campos aparecen en la cotización PDF.',
            },
            followups: ['info-update-today', 'info-project-type'],
          },
          {
            id: 'info-update-today',
            label: {
              en: 'What does the "Update to Today" button do?',
              es: '¿Qué hace el botón "Actualizar a Hoy"?',
            },
            answer: {
              en: 'The "Update to Today" button next to the quote date instantly sets the quote date to today\'s date without opening the edit form.\n\nUse it whenever you resend or update a quote so the date on the PDF reflects when it was last issued.',
              es: 'El botón "Actualizar a Hoy" junto a la fecha de cotización establece instantáneamente la fecha al día de hoy sin abrir el formulario de edición.\n\nÚsalo siempre que reenvíes o actualices una cotización para que la fecha en el PDF refleje cuándo fue emitida por última vez.',
            },
          },
          {
            id: 'info-project-type',
            label: {
              en: 'How do I change the project type?',
              es: '¿Cómo cambio el tipo de proyecto?',
            },
            answer: {
              en: 'Click "Edit" in the project header, then change the "Project Type" dropdown. Available types are Custom, Bids, Prefab, Stores, plus any custom types added in Settings.\n\nThe project type affects dashboard analytics — win rates and pipeline value are grouped and reported by type.',
              es: 'Haz clic en "Editar" en el encabezado del proyecto y cambia el desplegable "Tipo de Proyecto". Los tipos disponibles son Custom, Bids, Prefab, Stores, más cualquier tipo personalizado agregado en Configuración.\n\nEl tipo de proyecto afecta las analíticas del panel — las tasas de ganancia y el valor del pipeline se agrupan y reportan por tipo.',
            },
          },
        ],
      },
      {
        id: 'info-pricing-summary',
        label: { en: 'Pricing Summary Panel', es: 'Panel de Resumen de Precios' },
        questions: [
          {
            id: 'info-how-total',
            label: { en: 'How is the project total calculated?', es: '¿Cómo se calcula el total del proyecto?' },
            answer: {
              en: 'The total builds up in layers shown in the pricing summary panel:\n1. Cabinets Subtotal — sum of all cabinet costs across all areas\n2. Countertops Subtotal — sum of all countertop costs\n3. Items Subtotal — sum of additional items\n4. Materials Subtotal — total of all three above\n5. Sell Price = Materials Subtotal ÷ (1 − profit %)\n6. Tariff = (subtotal of areas with "Applies Tariff" on) × tariff %\n7. Install & Delivery — flat amount entered manually\n8. Referral = (Sell Price + Install & Delivery) × referral %\n9. Tax (IVA) = (Sell Price + Tariff) × tax %\n10. Final Total = Sell Price + Tariff + Referral + Tax + Install & Delivery + Other Expenses',
              es: 'El total se construye en capas mostradas en el panel de resumen:\n1. Subtotal Gabinetes — suma de todos los costos de gabinetes\n2. Subtotal Encimeras — suma de todos los costos de encimeras\n3. Subtotal Ítems — suma de ítems adicionales\n4. Subtotal Materiales — total de los tres anteriores\n5. Precio de Venta = Subtotal ÷ (1 − margen%)\n6. Arancel = (subtotal de áreas con "Aplica Arancel" activado) × arancel%\n7. Instalación y Entrega — monto fijo ingresado manualmente\n8. Referido = (Precio de Venta + Instalación) × % referido\n9. Impuesto (IVA) = (Precio de Venta + Arancel) × % impuesto\n10. Total Final = Precio de Venta + Arancel + Referido + Impuesto + Instalación + Otros Gastos',
            },
            followups: ['info-profit', 'info-tariff'],
          },
          {
            id: 'info-profit',
            label: { en: 'What is the Profit % and how do I set it?', es: '¿Qué es el % de Ganancia y cómo lo configuro?' },
            answer: {
              en: 'Profit % is a margin (not a simple markup). It means the materials cost is that % less than the final sell price.\n\nFormula: Sell Price = Cost ÷ (1 − profit%)\nExample: Cost = MX$70,000 with 30% profit → Sell Price = MX$100,000\n\nTo set it: find the "Profit %" input field in the pricing summary panel on the Info tab. Changes update the total in real time.',
              es: 'El % de Ganancia es un margen (no un markup simple). Significa que el costo de materiales es ese % menos que el precio de venta final.\n\nFórmula: Precio de Venta = Costo ÷ (1 − margen%)\nEjemplo: Costo = MX$70,000 con 30% → Precio de Venta = MX$100,000\n\nPara configurarlo: encuentra el campo "Ganancia %" en el panel de resumen de precios en la pestaña Info. Los cambios actualizan el total en tiempo real.',
            },
          },
          {
            id: 'info-tariff',
            label: { en: 'What is the Tariff % and when does it apply?', es: '¿Qué es el % de Arancel y cuándo aplica?' },
            answer: {
              en: 'Tariff is an additional charge on top of the materials cost, typically used for import duty surcharges on foreign-sourced materials.\n\nIt only applies to areas where the "Applies Tariff" toggle is turned ON (visible in the Pricing tab on each area header).\n\nTo set the tariff %: enter it in the "Tariff %" field in the pricing summary panel on the Info tab.\n\nUseful tip: turn off "Applies Tariff" on areas that use locally-sourced materials to keep those areas tariff-free.',
              es: 'El arancel es un cargo adicional sobre el costo de materiales, típicamente usado para recargos de aranceles de importación en materiales de origen extranjero.\n\nSolo aplica a las áreas donde el interruptor "Aplica Arancel" está ACTIVADO (visible en la pestaña Precios en el encabezado de cada área).\n\nPara configurar el %: ingrésalo en el campo "Arancel %" en el panel de resumen de precios en la pestaña Info.\n\nConsejo: desactiva "Aplica Arancel" en áreas con materiales de origen local.',
            },
          },
          {
            id: 'info-tax',
            label: { en: 'How do I configure taxes (IVA)?', es: '¿Cómo configuro los impuestos (IVA)?' },
            answer: {
              en: 'Enter the tax percentage in the "Tax %" field in the pricing summary panel on the Info tab. Tax is calculated on (Sell Price + Tariff).\n\nExample: If sell price is MX$100,000, tariff is MX$5,000, and tax is 16% → Tax = MX$16,800.',
              es: 'Ingresa el porcentaje de impuesto en el campo "Impuesto %" en el panel de resumen de precios en la pestaña Info. El impuesto se calcula sobre (Precio de Venta + Arancel).\n\nEjemplo: Si el precio de venta es MX$100,000, arancel MX$5,000 e impuesto 16% → Impuesto = MX$16,800.',
            },
          },
          {
            id: 'info-additional-costs',
            label: { en: 'How do I add install, delivery, and other costs?', es: '¿Cómo agrego instalación, entrega y otros costos?' },
            answer: {
              en: 'In the pricing summary panel on the Info tab:\n• Install & Delivery — enter the flat amount for installation and delivery charges\n• Other Expenses — a separate line for miscellaneous costs; you can also customize the label (e.g., "Design Fee", "Freight")\n• Design Services — enter design fees separately if applicable\n• Referral % — commission paid to a referral partner, calculated on Sell Price + Install',
              es: 'En el panel de resumen de precios en la pestaña Info:\n• Instalación y Entrega — ingresa el monto fijo por instalación y entrega\n• Otros Gastos — línea separada para costos varios; también puedes personalizar la etiqueta (ej: "Honorarios de Diseño", "Flete")\n• Servicios de Diseño — ingresa honorarios de diseño por separado si aplica\n• % Referido — comisión pagada a un referido, calculada sobre Precio de Venta + Instalación',
            },
          },
          {
            id: 'info-referral',
            label: {
              en: 'How does the Referral % work?',
              es: '¿Cómo funciona el % de Referido?',
            },
            answer: {
              en: 'Referral % is a commission paid to a partner who referred the client. It is calculated as:\n\nReferral = (Sell Price + Install & Delivery) × Referral %\n\nIt is added on top of the sell price in the final total, increasing the amount billed to the client. Enter the referral % in the Info tab pricing summary panel.\n\nExample: Sell Price = MX$100,000, Install = MX$5,000, Referral 5% → Referral amount = MX$5,250.',
              es: 'El % de Referido es una comisión pagada a un socio que refirió al cliente. Se calcula como:\n\nReferido = (Precio de Venta + Instalación y Entrega) × % Referido\n\nSe suma encima del precio de venta en el total final, incrementando el monto cobrado al cliente. Ingresa el % en el panel de resumen de la pestaña Info.\n\nEjemplo: Precio de Venta = MX$100,000, Instalación = MX$5,000, Referido 5% → Monto = MX$5,250.',
            },
          },
          {
            id: 'info-usd-summary',
            label: {
              en: 'What is the USD Summary PDF?',
              es: '¿Qué es el PDF de Resumen en USD?',
            },
            answer: {
              en: 'The USD Summary PDF is an alternative export that shows each area\'s financial breakdown in US Dollars:\n• Area sell price in USD\n• Tariff amount in USD\n• Profit margin percentage\n• Tax in USD\n\nAmounts are automatically converted using the exchange rate set in Settings → Currency. Generate it from the floating action bar → Print → USD Summary PDF.',
              es: 'El PDF de Resumen en USD es un formato alternativo que muestra el desglose financiero de cada área en Dólares Americanos:\n• Precio de venta del área en USD\n• Monto del arancel en USD\n• Porcentaje de margen de ganancia\n• Impuesto en USD\n\nLos montos se convierten automáticamente con el tipo de cambio configurado en Ajustes → Moneda. Genera este PDF desde la barra de acción flotante → Imprimir → PDF Resumen en USD.',
            },
          },
          {
            id: 'info-stale',
            label: { en: 'What does the "stale prices" warning mean?', es: '¿Qué significa la advertencia de "precios desactualizados"?' },
            answer: {
              en: 'When a material price is updated in the Price List, all projects using that material are automatically flagged as "stale." This means the project costs may not reflect current prices.\n\nTo fix it:\n1. Click the "Refresh Prices" button or the stale warning badge\n2. The Bulk Price Update modal shows which materials changed and the cost impact\n3. Review and click "Apply" to update all costs to current prices',
              es: 'Cuando se actualiza el precio de un material en la Lista de Precios, todos los proyectos que usan ese material se marcan automáticamente como "desactualizados". Esto significa que los costos pueden no reflejar los precios actuales.\n\nPara solucionarlo:\n1. Haz clic en el botón "Actualizar Precios" o en la insignia de advertencia\n2. El modal muestra qué materiales cambiaron y el impacto en costos\n3. Revisa y haz clic en "Aplicar"',
            },
          },
        ],
      },
      {
        id: 'info-pdf-overrides',
        label: { en: 'PDF Customization', es: 'Personalización del PDF' },
        questions: [
          {
            id: 'info-pdf-fields',
            label: { en: 'How do I customize what appears on the PDF quote?', es: '¿Cómo personalizo lo que aparece en la cotización PDF?' },
            answer: {
              en: 'In the Info tab, you can override the following fields specifically for the PDF (without changing the internal project data):\n• PDF Project Name — shown as the project title on the PDF\n• PDF Customer Name — overrides the customer name on the PDF\n• PDF Address — overrides the address shown\n• PDF Project Brief — a custom description/scope of work paragraph\n\nLeave these blank to use the original project values.',
              es: 'En la pestaña Info, puedes sobreescribir los siguientes campos específicamente para el PDF (sin cambiar los datos internos del proyecto):\n• Nombre PDF del Proyecto — se muestra como título en el PDF\n• Nombre PDF del Cliente — sobreescribe el nombre del cliente en el PDF\n• Dirección PDF — sobreescribe la dirección mostrada\n• Brief PDF del Proyecto — párrafo personalizado de descripción/alcance del trabajo\n\nDeja estos campos en blanco para usar los valores originales del proyecto.',
            },
            followups: ['info-disclaimers'],
          },
          {
            id: 'info-disclaimers',
            label: { en: 'How do I edit the PDF disclaimers?', es: '¿Cómo edito los avisos del PDF?' },
            answer: {
              en: 'In the Info tab, scroll down to the "PDF Disclaimers" section. You can edit two disclaimer texts that appear at the bottom of the PDF:\n• Tariff Information Disclaimer — explains tariff/import duty charges\n• Price Validity & Conditions Disclaimer — explains how long the quote is valid\n\nThese are pre-filled from your default disclaimers in Settings but can be customized per project.',
              es: 'En la pestaña Info, desplázate hasta la sección "Avisos PDF". Puedes editar dos textos de aviso que aparecen al final del PDF:\n• Aviso de Información de Arancel — explica los cargos de arancel\n• Aviso de Vigencia y Condiciones de Precios — explica por cuánto tiempo es válida la cotización\n\nEstos se pre-llenan desde tus avisos predeterminados en Configuración pero pueden personalizarse por proyecto.',
            },
          },
          {
            id: 'info-print-pdf',
            label: { en: 'How do I generate the PDF quote?', es: '¿Cómo genero la cotización PDF?' },
            answer: {
              en: 'Click the print/PDF icon in the project header (top area of the page). You can choose:\n• MXN — shows all amounts in Mexican Pesos\n• USD — divides all amounts by the configured exchange rate\n\nThe PDF shows the customer-facing price (with profit, tariff, and taxes applied). Material costs are NOT shown to the customer.',
              es: 'Haz clic en el ícono de impresión/PDF en el encabezado del proyecto (parte superior de la página). Puedes elegir:\n• MXN — muestra todos los montos en Pesos Mexicanos\n• USD — divide todos los montos por el tipo de cambio configurado\n\nEl PDF muestra el precio final al cliente (con ganancia, arancel e impuestos). Los costos de materiales NO se muestran al cliente.',
            },
          },
        ],
      },
    ],
  },

  'project-pricing': {
    welcome: {
      en: 'You\'re on the Pricing tab — this is where you build the project by adding areas, cabinets, countertops, and items. What do you need help with?',
      es: 'Estás en la pestaña Precios — aquí construyes el proyecto agregando áreas, gabinetes, encimeras e ítems. ¿En qué necesitas ayuda?',
    },
    categories: [
      {
        id: 'pricing-areas',
        label: { en: 'Areas', es: 'Áreas' },
        questions: [
          {
            id: 'pricing-add-area',
            label: { en: 'How do I add a new area?', es: '¿Cómo agrego un área nueva?' },
            answer: {
              en: 'Click the "Add Area" button at the bottom of the Pricing tab. Enter a name (e.g., "Kitchen", "Master Bath", "Living Room") and click Save.\n\nEach area is a logical grouping of cabinets, countertops, and items. Areas can each have their tariff toggle set independently.',
              es: 'Haz clic en el botón "Agregar Área" en la parte inferior de la pestaña Precios. Ingresa un nombre (ej: "Cocina", "Baño Principal", "Sala") y haz clic en Guardar.\n\nCada área es una agrupación lógica de gabinetes, encimeras e ítems. Cada área puede tener su interruptor de arancel configurado de forma independiente.',
            },
            followups: ['pricing-reorder-areas', 'pricing-tariff-area'],
          },
          {
            id: 'pricing-reorder-areas',
            label: { en: 'How do I reorder areas?', es: '¿Cómo reordeno las áreas?' },
            answer: {
              en: 'You can reorder areas two ways:\n• Drag — grab the grip handle icon (≡) on the left side of the area header and drag to the desired position\n• Arrows — use the up/down arrow buttons on the right side of the area header\n\nThe order is saved automatically.',
              es: 'Puedes reordenar áreas de dos formas:\n• Arrastrar — agarra el ícono de asa (≡) en el lado izquierdo del encabezado del área y arrástralo a la posición deseada\n• Flechas — usa los botones de flecha arriba/abajo en el lado derecho del encabezado del área\n\nEl orden se guarda automáticamente.',
            },
          },
          {
            id: 'pricing-tariff-area',
            label: { en: 'How do I toggle tariff on/off for an area?', es: '¿Cómo activo/desactivo el arancel en un área?' },
            answer: {
              en: 'Each area header has an "Applies Tariff" badge/toggle. Click it to turn it on or off.\n\n• ON (yellow badge) — this area\'s cost is included in the tariff calculation\n• OFF — this area is excluded from the tariff surcharge\n\nThis is useful when some areas use locally-sourced materials that shouldn\'t carry an import tariff.',
              es: 'El encabezado de cada área tiene una insignia/interruptor "Aplica Arancel". Haz clic para activarlo o desactivarlo.\n\n• Activado (insignia amarilla) — el costo de esta área se incluye en el cálculo del arancel\n• Desactivado — esta área se excluye del recargo de arancel\n\nEsto es útil cuando algunas áreas usan materiales de origen local que no deberían llevar arancel de importación.',
            },
          },
          {
            id: 'pricing-rename-delete-area',
            label: { en: 'How do I rename or delete an area?', es: '¿Cómo renombro o elimino un área?' },
            answer: {
              en: 'On the area header:\n• Rename — click the pencil/edit icon next to the area name\n• Delete — click the trash icon on the area header\n\nDeleting an area removes ALL its cabinets, countertops, and items permanently.',
              es: 'En el encabezado del área:\n• Renombrar — haz clic en el ícono de lápiz/editar junto al nombre del área\n• Eliminar — haz clic en el ícono de basura en el encabezado del área\n\nEliminar un área elimina TODOS sus gabinetes, encimeras e ítems permanentemente.',
            },
          },
        ],
      },
      {
        id: 'pricing-cabinets',
        label: { en: 'Cabinets', es: 'Gabinetes' },
        questions: [
          {
            id: 'pricing-add-cabinet',
            label: { en: 'How do I add a cabinet to an area?', es: '¿Cómo agrego un gabinete a un área?' },
            answer: {
              en: 'Click "Add Cabinet" inside an area. In the cabinet form:\n1. Select the product SKU (search by SKU or description)\n2. Set the quantity\n3. Select box material + box edgeband\n4. Select door material + door edgeband\n5. Optionally: add interior finish, back panel, door profile\n6. Add hardware (handles, hinges, slides) with quantities per cabinet\n7. Add accessories if needed\n8. Toggle "RTA" (Ready-To-Assemble) if applicable\n9. Click Save — cost calculates automatically',
              es: 'Haz clic en "Agregar Gabinete" dentro de un área. En el formulario:\n1. Selecciona el SKU del producto (busca por SKU o descripción)\n2. Establece la cantidad\n3. Selecciona material de caja + canteado de caja\n4. Selecciona material de puertas + canteado de puertas\n5. Opcionalmente: agrega acabado interior, panel trasero, perfil de puerta\n6. Agrega herrajes (jaladores, bisagras, correderas) con cantidades por gabinete\n7. Agrega accesorios si es necesario\n8. Activa "RTA" (Listo Para Ensamblar) si aplica\n9. Haz clic en Guardar — el costo se calcula automáticamente',
            },
            followups: ['pricing-edit-cabinet', 'pricing-template-load'],
          },
          {
            id: 'pricing-edit-cabinet',
            label: { en: 'How do I edit a cabinet?', es: '¿Cómo edito un gabinete?' },
            answer: {
              en: 'On the cabinet card, click the pencil/edit icon. This opens the same form you used to add it — change any fields and click Save. The cost recalculates automatically.\n\nYou can also:\n• Duplicate — copies the cabinet in the same area\n• Move to area — moves it to a different area\n• Save as Template — saves current configuration as a reusable template',
              es: 'En la tarjeta del gabinete, haz clic en el ícono de lápiz/editar. Esto abre el mismo formulario que usaste para agregarlo — cambia los campos y haz clic en Guardar. El costo se recalcula automáticamente.\n\nTambién puedes:\n• Duplicar — copia el gabinete en el mismo área\n• Mover a área — lo mueve a otra área\n• Guardar como Plantilla — guarda la configuración como plantilla reutilizable',
            },
          },
          {
            id: 'pricing-template-load',
            label: { en: 'How do I load a cabinet from a template?', es: '¿Cómo cargo un gabinete desde una plantilla?' },
            answer: {
              en: 'When adding a cabinet, click "Load from Template" (or the template icon in the form). Browse or search templates by name or category, then select one. All fields (SKU, materials, hardware, accessories) are pre-filled.\n\nYou can still modify any field before saving. A warning appears if any referenced materials are archived.',
              es: 'Al agregar un gabinete, haz clic en "Cargar Plantilla" (o el ícono de plantilla en el formulario). Navega o busca plantillas por nombre o categoría, luego selecciona una. Todos los campos (SKU, materiales, herrajes, accesorios) se pre-llenan.\n\nAún puedes modificar cualquier campo antes de guardar. Aparece una advertencia si algún material referenciado está archivado.',
            },
          },
          {
            id: 'pricing-cabinet-cost',
            label: { en: 'How is a cabinet\'s cost calculated?', es: '¿Cómo se calcula el costo de un gabinete?' },
            answer: {
              en: 'Each cabinet\'s cost = sum of all components × quantity:\n1. Box material = (product box SF × waste multiplier) ÷ SF per sheet × price per sheet\n2. Box edgeband = product edgeband meters × price per meter\n3. Door material = (product door SF × waste multiplier) ÷ SF per sheet × price per sheet\n4. Door edgeband = door edgeband meters × price per meter\n5. Back panel = (custom back panel SF ÷ SF per sheet) × price\n6. Door profile = price per linear foot × door perimeter\n7. Hardware = sum of (qty per cabinet × unit price) for each item\n8. Accessories = sum of accessory prices\n9. Labor = base labor (with or without drawers) or custom labor if set on the SKU',
              es: 'El costo de cada gabinete = suma de todos los componentes × cantidad:\n1. Material de caja = (SF de caja × multiplicador de desperdicio) ÷ SF por lámina × precio por lámina\n2. Canteado de caja = metros de canteado × precio por metro\n3. Material de puertas = (SF de puertas × multiplicador de desperdicio) ÷ SF por lámina × precio por lámina\n4. Canteado de puertas = metros × precio por metro\n5. Panel trasero = (SF del panel ÷ SF por lámina) × precio\n6. Perfil de puerta = precio por pie lineal × perímetro de puerta\n7. Herrajes = suma de (cantidad por gabinete × precio unitario)\n8. Accesorios = suma de precios\n9. Mano de obra = base (con o sin cajones) o personalizada si está en el SKU',
            },
          },
          {
            id: 'pricing-bulk-material',
            label: { en: 'How do I change materials for multiple cabinets at once?', es: '¿Cómo cambio materiales para múltiples gabinetes a la vez?' },
            answer: {
              en: 'Use Bulk Material Change (in the floating action bar at the bottom of the page):\n1. Click "Bulk Material Change"\n2. Select the area (or "All Areas")\n3. Select the material type (box material, door material, edgeband, etc.)\n4. Select the current material to replace and the new material\n5. A preview shows all affected cabinets and the cost impact\n6. Click "Apply" to update all matching cabinets at once',
              es: 'Usa el Cambio Masivo de Material (en la barra de acción flotante en la parte inferior):\n1. Haz clic en "Cambio Masivo de Material"\n2. Selecciona el área (o "Todas las Áreas")\n3. Selecciona el tipo de material (caja, puertas, canteado, etc.)\n4. Selecciona el material actual a reemplazar y el nuevo\n5. Una vista previa muestra los gabinetes afectados y el impacto en costos\n6. Haz clic en "Aplicar" para actualizar todos los gabinetes a la vez',
            },
          },
          {
            id: 'pricing-rta',
            label: {
              en: 'What does the RTA toggle do?',
              es: '¿Qué hace el interruptor RTA?',
            },
            answer: {
              en: '"RTA" stands for Ready-To-Assemble. When toggled ON on a cabinet:\n• Labor cost is reduced — assembly is not included in production\n• The cabinet is flagged in reports as an RTA unit\n\nRTA cabinets are pre-assembled kits sourced externally. The labor saving reflects that your shop is not manufacturing the box from scratch.\n\nEach product SKU has a "Default RTA" flag that pre-fills this toggle when you add the cabinet. You can always override it per cabinet.',
              es: '"RTA" significa Listo Para Ensamblar (Ready-To-Assemble). Cuando está activado en un gabinete:\n• El costo de mano de obra se reduce — el ensamblaje no está incluido en producción\n• El gabinete se marca en los reportes como unidad RTA\n\nLos gabinetes RTA son kits pre-ensamblados de fuente externa. El ahorro en mano de obra refleja que tu taller no fabrica la caja desde cero.\n\nCada SKU de producto tiene una marca "RTA predeterminado" que pre-llena este interruptor al agregar el gabinete. Siempre puedes sobreescribirlo por gabinete.',
            },
          },
          {
            id: 'pricing-back-panel',
            label: {
              en: 'What is the back panel option in the cabinet form?',
              es: '¿Qué es la opción de panel trasero en el formulario de gabinete?',
            },
            answer: {
              en: 'The back panel is an optional decorative or structural panel applied to the inside back of a cabinet — typically used in open shelving, display cabinets, or when the back wall is visible.\n\nSelect a back panel material from the price list and enter the square footage. Cost = (Back panel SF ÷ SF per sheet) × price per sheet.\n\nLeave it blank for standard cabinets mounted against a wall where the back is not visible.',
              es: 'El panel trasero es un panel decorativo o estructural opcional aplicado en la parte trasera interior de un gabinete — típicamente usado en estantes abiertos, gabinetes de exhibición o cuando la pared trasera es visible.\n\nSelecciona un material de panel trasero de la lista de precios e ingresa los pies cuadrados. Costo = (SF del panel ÷ SF por lámina) × precio por lámina.\n\nDéjalo en blanco para gabinetes estándar montados contra una pared donde el fondo no es visible.',
            },
          },
          {
            id: 'pricing-interior-finish',
            label: {
              en: 'What is the interior finish option?',
              es: '¿Qué es la opción de acabado interior?',
            },
            answer: {
              en: 'Interior finish is a different sheet material applied to the visible interior surfaces of the cabinet (shelves, interior walls) — for example, a wood veneer, melamine, or a contrasting color to the box material.\n\nSelect it from the price list in the cabinet form. Cost is calculated the same way as box material: (box SF × waste) ÷ SF per sheet × price.\n\nLeave it blank when the interior and exterior use the same material.',
              es: 'El acabado interior es un material de lámina diferente aplicado a las superficies interiores visibles del gabinete (entrepaños, paredes interiores) — por ejemplo, chapa de madera, melamina o un color contrastante al material de caja.\n\nSelecciónalo de la lista de precios en el formulario del gabinete. El costo se calcula igual que el material de caja: (SF de caja × desperdicio) ÷ SF por lámina × precio.\n\nDéjalo en blanco cuando interior y exterior usen el mismo material.',
            },
          },
          {
            id: 'pricing-door-profile',
            label: {
              en: 'What is a door profile and when do I use it?',
              es: '¿Qué es un perfil de puerta y cuándo lo uso?',
            },
            answer: {
              en: 'A door profile is a premium edge treatment applied to the perimeter of door panels — such as a routed edge, radius, or aluminum J-channel.\n\nIn the cabinet form, select a door profile from the price list. Cost = profile price per linear foot × the door\'s full perimeter in feet.\n\nOnly add a door profile when the project spec calls for it. Standard slab doors with a simple edgeband do not need one.',
              es: 'Un perfil de puerta es un acabado premium aplicado al perímetro de los paneles de puertas — como un fresado, radio o canal J de aluminio.\n\nEn el formulario del gabinete, selecciona un perfil de puerta de la lista de precios. Costo = precio del perfil por pie lineal × el perímetro completo de la puerta en pies.\n\nAgrega un perfil de puerta solo cuando la especificación del proyecto lo requiera. Las puertas slab estándar con canteado simple no lo necesitan.',
            },
          },
          {
            id: 'pricing-bulk-hardware',
            label: {
              en: 'How do I change hardware for multiple cabinets at once?',
              es: '¿Cómo cambio los herrajes de múltiples gabinetes a la vez?',
            },
            answer: {
              en: 'Use the Bulk Hardware Change feature accessible from the floating action bar → Materials.\n\nThe flow:\n1. Select the hardware type to replace (handles, hinges, drawer slides, etc.)\n2. Select the current hardware item\n3. Select the replacement hardware item\n4. Choose scope: one area or all areas\n5. Review the preview showing affected cabinets\n6. Click Apply\n\nUseful when a client changes hardware finish across the entire project (e.g., matte black → brushed nickel).',
              es: 'Usa la función de Cambio Masivo de Herrajes accesible desde la barra de acción flotante → Materiales.\n\nEl flujo:\n1. Selecciona el tipo de herraje a reemplazar (jaladores, bisagras, correderas, etc.)\n2. Selecciona el herraje actual\n3. Selecciona el herraje de reemplazo\n4. Elige el alcance: un área o todas las áreas\n5. Revisa la vista previa con los gabinetes afectados\n6. Haz clic en Aplicar\n\nÚtil cuando un cliente cambia el acabado del herraje en todo el proyecto (ej: negro mate → níquel cepillado).',
            },
          },
        ],
      },
      {
        id: 'pricing-countertops-items',
        label: { en: 'Countertops & Additional Items', es: 'Encimeras e Ítems Adicionales' },
        questions: [
          {
            id: 'pricing-add-countertop',
            label: { en: 'How do I add a countertop?', es: '¿Cómo agrego una encimera?' },
            answer: {
              en: 'Inside an area, click "Add Countertops". In the form:\n1. Select the countertop type from the price list (e.g., Quartz, Solid Surface)\n2. Set the quantity\n3. Optionally enter dimensions: length × width in inches — square footage is calculated automatically\n4. The unit price comes from the price list item\n5. Click Save\n\nCountertops count toward the area subtotal.',
              es: 'Dentro de un área, haz clic en "Agregar Encimeras". En el formulario:\n1. Selecciona el tipo de encimera de la lista de precios (ej: Cuarzo, Superficie Sólida)\n2. Establece la cantidad\n3. Opcionalmente ingresa dimensiones: largo × ancho en pulgadas — los pies cuadrados se calculan automáticamente\n4. El precio unitario proviene del ítem de la lista de precios\n5. Haz clic en Guardar\n\nLas encimeras cuentan en el subtotal del área.',
            },
          },
          {
            id: 'pricing-add-item',
            label: { en: 'How do I add additional items to an area?', es: '¿Cómo agrego ítems adicionales a un área?' },
            answer: {
              en: 'Inside an area, click "Add Additional Items". You can add any item from the price list — installation labor, delivery, pull-out organizers, specialty accessories, etc.\n\nSet the quantity, and optionally add notes. The unit price comes from the price list. These items count toward the area subtotal.',
              es: 'Dentro de un área, haz clic en "Agregar Ítems Adicionales". Puedes agregar cualquier ítem de la lista de precios — mano de obra de instalación, entrega, organizadores, accesorios especiales, etc.\n\nEstablece la cantidad y opcionalmente agrega notas. El precio unitario proviene de la lista de precios. Estos ítems cuentan en el subtotal del área.',
            },
          },
          {
            id: 'pricing-material-breakdown',
            label: { en: 'What is the material breakdown and how do I view it?', es: '¿Qué es el desglose de materiales y cómo lo veo?' },
            answer: {
              en: 'The material breakdown summarizes all materials used across cabinets in an area — how many sheets of each panel material are needed, how many meters/rolls of edgeband, and hardware/accessory quantities with costs.\n\nTo view it: click the "Materials" button on an area, or click the material breakdown icon on a cabinet card. It\'s useful for purchasing and production planning.',
              es: 'El desglose de materiales resume todos los materiales usados en los gabinetes de un área — cuántas láminas de cada material de panel se necesitan, cuántos metros/rollos de canteado, y cantidades de herrajes/accesorios con costos.\n\nPara verlo: haz clic en el botón "Materiales" en un área, o en el ícono de desglose de materiales en una tarjeta de gabinete. Útil para compras y planificación de producción.',
            },
          },
        ],
      },
      {
        id: 'pricing-export',
        label: { en: 'Export Options', es: 'Opciones de Exportación' },
        questions: [
          {
            id: 'pricing-csv',
            label: { en: 'How do I export a CSV of the project?', es: '¿Cómo exporto un CSV del proyecto?' },
            answer: {
              en: 'In the floating action bar at the bottom, click "Export CSV". This generates a spreadsheet file showing all areas, cabinets, quantities, materials, and costs. Useful for sharing with production or manufacturing teams.',
              es: 'En la barra de acción flotante en la parte inferior, haz clic en "Exportar CSV". Esto genera un archivo de hoja de cálculo con todas las áreas, gabinetes, cantidades, materiales y costos. Útil para compartir con equipos de producción o fabricación.',
            },
          },
          {
            id: 'pricing-json-export',
            label: { en: 'How do I create a backup of the project?', es: '¿Cómo creo un respaldo del proyecto?' },
            answer: {
              en: 'In the floating action bar at the bottom, click "Export JSON" (or the backup icon). This saves a complete project file including all areas, cabinets, materials, and settings.\n\nThis file can later be imported via "Import Project" on the Projects list to restore or share the project.',
              es: 'En la barra de acción flotante en la parte inferior, haz clic en "Exportar JSON" (o el ícono de respaldo). Esto guarda un archivo completo del proyecto con todas las áreas, gabinetes, materiales y configuraciones.\n\nEste archivo puede importarse después mediante "Importar Proyecto" en la lista de Proyectos para restaurar o compartir el proyecto.',
            },
          },
        ],
      },
      {
        id: 'printing-saving',
        label: { en: 'Printing & Saving', es: 'Imprimir y Guardar' },
        questions: [
          {
            id: 'pricing-print-standard',
            label: {
              en: 'How do I generate the PDF quote?',
              es: '¿Cómo genero la cotización PDF?',
            },
            answer: {
              en: 'Open the floating action bar (☰ icon, bottom-right). Click "Print" → "Standard PDF".\n\nThe PDF includes:\n• All areas with their cabinet list and quantities\n• Area subtotals, sell price, tariff, and taxes\n• Company header with logo\n• Customer-facing price only — material costs are NOT shown\n\nAmounts are shown in MXN by default.',
              es: 'Abre la barra de acción flotante (ícono ☰, esquina inferior derecha). Haz clic en "Imprimir" → "PDF Estándar".\n\nEl PDF incluye:\n• Todas las áreas con su lista de gabinetes y cantidades\n• Subtotales por área, precio de venta, arancel e impuestos\n• Encabezado con logo de la empresa\n• Solo precio al cliente — los costos de materiales NO se muestran\n\nLos montos se muestran en MXN por defecto.',
            },
            followups: ['pricing-print-usd'],
          },
          {
            id: 'pricing-print-usd',
            label: {
              en: 'How do I print the USD Summary PDF?',
              es: '¿Cómo imprimo el PDF de resumen en USD?',
            },
            answer: {
              en: 'In the floating action bar, click "Print" → "USD Summary PDF".\n\nThis version shows each area\'s price, tariff amount, profit margin, and tax converted to USD using the exchange rate in Settings → Currency.\n\nUseful for clients or partners who operate in USD. The totals are the same as the standard PDF — just in a different currency.',
              es: 'En la barra de acción flotante, haz clic en "Imprimir" → "PDF de Resumen en USD".\n\nEsta versión muestra el precio, arancel, margen de ganancia e impuesto de cada área convertidos a USD usando el tipo de cambio en Ajustes → Moneda.\n\nÚtil para clientes o socios que operan en USD. Los totales son los mismos que el PDF estándar — solo en divisa diferente.',
            },
          },
          {
            id: 'pricing-save-project',
            label: {
              en: 'How do I save the project?',
              es: '¿Cómo guardo el proyecto?',
            },
            answer: {
              en: 'Click the green circular Save button (💾) at the bottom-right of the page, always visible above the floating action bar.\n\nMost actions (adding cabinets, changing materials) are saved automatically. The Save button ensures all pending changes — such as area reordering or manual edits — are committed to the database.',
              es: 'Haz clic en el botón verde circular de Guardar (💾) en la esquina inferior derecha, siempre visible sobre la barra de acción flotante.\n\nLa mayoría de las acciones (agregar gabinetes, cambiar materiales) se guardan automáticamente. El botón Guardar asegura que todos los cambios pendientes — como el reordenamiento de áreas o ediciones manuales — queden confirmados en la base de datos.',
            },
          },
          {
            id: 'pricing-recalculate-tip',
            label: {
              en: 'Should I recalculate prices before sending a quote?',
              es: '¿Debo recalcular los precios antes de enviar una cotización?',
            },
            answer: {
              en: '✅ Yes — always run "Prices" before finalizing a quote.\n\nIn the floating action bar, click "Prices". This recalculates every cabinet cost using current price list values, ensuring no price changes were missed.\n\nRecommended workflow to close a quote:\n1. Finish adding all cabinets and items\n2. Click "Prices" in the toolbar → review the cost impact → Apply\n3. Click the green Save button\n4. Print the PDF\n5. Change project status to "Sent"\n\nSkipping this risks sending a quote with outdated costs if any price list items were updated after the cabinets were added.',
              es: '✅ Sí — siempre ejecuta "Precios" antes de finalizar una cotización.\n\nEn la barra de acción flotante, haz clic en "Precios". Esto recalcula cada costo de gabinete usando los valores actuales de la lista de precios, asegurando que ningún cambio de precio haya quedado pendiente.\n\nFlujo de trabajo recomendado para cerrar una cotización:\n1. Termina de agregar todos los gabinetes e ítems\n2. Haz clic en "Precios" en la barra → revisa el impacto en costos → Aplicar\n3. Haz clic en el botón verde Guardar\n4. Imprime el PDF\n5. Cambia el estado del proyecto a "Enviado"\n\nOmitir este paso arriesga enviar una cotización con costos desactualizados si algún ítem de la lista de precios fue modificado después de agregar los gabinetes.',
            },
          },
        ],
      },
      {
        id: 'pricing-toolbar',
        label: { en: 'Floating Action Bar', es: 'Barra de Acción Flotante' },
        questions: [
          {
            id: 'toolbar-what-is',
            label: {
              en: 'What is the floating action bar at the bottom?',
              es: '¿Qué es la barra de acción flotante en la parte inferior?',
            },
            answer: {
              en: 'The floating action bar gives quick access to all project-level actions without leaving the current view. Click the ☰ icon (bottom-right) to expand it into a pill bar.\n\nAvailable actions in order:\n• Create Cabinet — add a cabinet directly to the project\n• Materials — bulk material change across areas\n• Prices — recalculate all costs with current price list\n• Print → Standard PDF / USD Summary PDF\n• CSV → Areas Summary or Detailed Report\n• JSON — full project backup\n\nTwo always-visible buttons above the bar:\n• 💾 Save (green) — saves all pending changes\n• ＋ Add Area (blue) — adds a new area',
              es: 'La barra de acción flotante da acceso rápido a todas las acciones del proyecto sin salir de la vista actual. Haz clic en el ícono ☰ (esquina inferior derecha) para expandirla en una barra pill.\n\nAcciones disponibles en orden:\n• Crear Gabinete — agrega un gabinete directamente al proyecto\n• Materiales — cambio masivo de materiales en las áreas\n• Precios — recalcular todos los costos con la lista de precios actual\n• Imprimir → PDF Estándar / PDF Resumen en USD\n• CSV → Resumen de Áreas o Reporte Detallado\n• JSON — respaldo completo del proyecto\n\nDos botones siempre visibles sobre la barra:\n• 💾 Guardar (verde) — guarda todos los cambios pendientes\n• ＋ Agregar Área (azul) — agrega una nueva área',
            },
            followups: ['toolbar-create-cabinet', 'toolbar-csv-options'],
          },
          {
            id: 'toolbar-create-cabinet',
            label: {
              en: 'How do I add a cabinet without leaving the project?',
              es: '¿Cómo agrego un gabinete sin salir del proyecto?',
            },
            answer: {
              en: 'In the floating action bar, click "Create Cabinet" (the first button in the pill bar after the × close button).\n\nThis opens the Add Cabinet form as an overlay — select the area, choose the product SKU, configure materials and hardware, and click Save. The cabinet is added immediately without navigating away.\n\nIf you need to create a new product SKU first, go to Products Catalog → Add Product and return to the project afterward.',
              es: 'En la barra de acción flotante, haz clic en "Crear Gabinete" (el primer botón en la barra pill después del botón de cerrar ×).\n\nEsto abre el formulario de Agregar Gabinete como superposición — selecciona el área, elige el SKU del producto, configura materiales y herrajes, y haz clic en Guardar. El gabinete se agrega de inmediato sin navegar a otra página.\n\nSi necesitas crear un nuevo SKU primero, ve a Catálogo de Productos → Agregar Producto y regresa al proyecto.',
            },
          },
          {
            id: 'toolbar-csv-options',
            label: {
              en: 'What is the difference between the two CSV exports?',
              es: '¿Cuál es la diferencia entre las dos exportaciones CSV?',
            },
            answer: {
              en: 'Two CSV exports are available from the floating action bar:\n\n• Areas Summary — one row per area: name, cabinet count, and subtotal. Compact overview for budget sharing.\n\n• Detailed Report — one row per cabinet entry: SKU, description, quantity, all materials, hardware, and unit/total costs. Full production-ready detail.',
              es: 'Dos exportaciones CSV disponibles desde la barra de acción flotante:\n\n• Resumen de Áreas — una fila por área: nombre, cantidad de gabinetes y subtotal. Vista compacta para compartir presupuestos.\n\n• Reporte Detallado — una fila por gabinete: SKU, descripción, cantidad, todos los materiales, herrajes y costos unitarios/totales. Detalle completo listo para producción.',
            },
          },
        ],
      },
      {
        id: 'pricing-shipping',
        label: { en: 'Shipping & Closets', es: 'Envío y Closets' },
        questions: [
          {
            id: 'pricing-shipping-summary',
            label: {
              en: 'What is the Shipping Summary?',
              es: '¿Qué es el Resumen de Envío?',
            },
            answer: {
              en: 'Each area shows a Shipping Summary that calculates:\n• Boxes — total shipping boxes based on the "Boxes per Unit" value set on each product SKU\n• Pallets — boxes ÷ 6 (rounded up)\n• Acc. ft² — accumulated square footage of the area\'s cabinets\n\nThis helps logistics teams plan trucking and storage without leaving the quotation.',
              es: 'Cada área muestra un Resumen de Envío que calcula:\n• Cajas — total de cajas de envío basado en el valor "Cajas por Unidad" del SKU de cada producto\n• Tarimas — cajas ÷ 6 (redondeado hacia arriba)\n• Ft² Acum. — pies cuadrados acumulados de los gabinetes del área\n\nEsto ayuda a los equipos de logística a planificar el transporte y almacenamiento sin salir de la cotización.',
            },
          },
          {
            id: 'pricing-add-closet',
            label: {
              en: 'How do I add a closet system to an area?',
              es: '¿Cómo agrego un sistema de closet a un área?',
            },
            answer: {
              en: 'Inside an area, click "Add Closet". Select a closet catalog item and set the quantity. Closet items come from the Closet Catalog managed in Products Catalog → Closets tab.\n\nCloset items appear in the area cabinet list and contribute to the area subtotal like cabinets and countertops.',
              es: 'Dentro de un área, haz clic en "Agregar Closet". Selecciona un ítem del catálogo de closets y establece la cantidad. Los ítems provienen del Catálogo de Closets gestionado en Catálogo de Productos → pestaña Closets.\n\nLos ítems de closet aparecen en la lista del área y contribuyen al subtotal como los gabinetes y encimeras.',
            },
          },
        ],
      },
    ],
  },

  'project-analytics': {
    welcome: {
      en: 'You\'re on the Analytics tab. This shows visual breakdowns of your project\'s costs and composition. What would you like to understand?',
      es: 'Estás en la pestaña Analíticas. Aquí se muestran desgloses visuales de los costos y composición del proyecto. ¿Qué te gustaría entender?',
    },
    categories: [
      {
        id: 'analytics-charts',
        label: { en: 'Understanding the Charts', es: 'Entender las Gráficas' },
        questions: [
          {
            id: 'analytics-what-shows',
            label: { en: 'What do the analytics charts show?', es: '¿Qué muestran las gráficas de analíticas?' },
            answer: {
              en: 'The Analytics tab shows visual breakdowns of your project including:\n• Cost distribution by area — which areas have the most cost\n• Material cost breakdown — how much each material type contributes\n• Cabinet type distribution — the mix of cabinet SKUs used\n• Cost vs sell price comparison — showing the margin impact\n\nThese charts update automatically as you add or edit cabinets.',
              es: 'La pestaña Analíticas muestra desgloses visuales del proyecto incluyendo:\n• Distribución de costos por área — qué áreas tienen más costo\n• Desglose de costos de materiales — cuánto aporta cada tipo de material\n• Distribución de tipos de gabinetes — la mezcla de SKUs usados\n• Comparación costo vs precio de venta — mostrando el impacto del margen\n\nEstas gráficas se actualizan automáticamente al agregar o editar gabinetes.',
            },
          },
          {
            id: 'analytics-empty',
            label: { en: 'Why is the analytics tab empty?', es: '¿Por qué la pestaña de analíticas está vacía?' },
            answer: {
              en: 'The analytics tab requires at least one area with at least one cabinet to show charts. Go to the Pricing tab and add areas and cabinets first, then return here to see the visual breakdowns.',
              es: 'La pestaña de analíticas requiere al menos un área con al menos un gabinete para mostrar gráficas. Ve a la pestaña Precios y agrega áreas y gabinetes primero, luego regresa aquí para ver los desgloses visuales.',
            },
          },
          {
            id: 'analytics-materials',
            label: { en: 'How do I read the material cost breakdown?', es: '¿Cómo leo el desglose de costos de materiales?' },
            answer: {
              en: 'The material cost breakdown shows the total cost attributed to each material category (box materials, door materials, edgebanding, hardware, labor, etc.) across the entire project.\n\nThis helps you understand where your largest cost drivers are — for example, if hardware is a large portion, you might look for alternative hardware options.',
              es: 'El desglose de costos de materiales muestra el costo total atribuido a cada categoría de material (materiales de caja, puertas, canteado, herrajes, mano de obra, etc.) en todo el proyecto.\n\nEsto te ayuda a entender dónde están tus mayores impulsores de costo — por ejemplo, si los herrajes representan una gran parte, podrías buscar alternativas.',
            },
          },
        ],
      },
    ],
  },

  'project-history': {
    welcome: {
      en: 'You\'re on the History tab. Here you can view and restore previous versions of this project. What do you need help with?',
      es: 'Estás en la pestaña Historial. Aquí puedes ver y restaurar versiones anteriores de este proyecto. ¿En qué necesitas ayuda?',
    },
    categories: [
      {
        id: 'history-versions',
        label: { en: 'Version History', es: 'Historial de Versiones' },
        questions: [
          {
            id: 'history-what-is',
            label: { en: 'What is version history?', es: '¿Qué es el historial de versiones?' },
            answer: {
              en: 'Version history automatically saves snapshots of your project whenever significant changes are made — such as adding or deleting cabinets, changing materials, or updating costs.\n\nEach version records:\n• The timestamp of the change\n• A description of what changed\n• A complete snapshot of the project state at that point',
              es: 'El historial de versiones guarda automáticamente instantáneas del proyecto cuando se realizan cambios significativos — como agregar o eliminar gabinetes, cambiar materiales o actualizar costos.\n\nCada versión registra:\n• La marca de tiempo del cambio\n• Una descripción de qué cambió\n• Una instantánea completa del estado del proyecto en ese momento',
            },
            followups: ['history-restore'],
          },
          {
            id: 'history-restore',
            label: { en: 'How do I restore a previous version?', es: '¿Cómo restauro una versión anterior?' },
            answer: {
              en: 'Find the version you want to restore in the History tab. Click "Restore This Version" on that version card.\n\nThe project will revert to the saved state — all areas, cabinets, materials, and costs from that snapshot will be restored.\n\nA new version is automatically saved before the restore, so you can always undo the restoration if needed.',
              es: 'Encuentra la versión que deseas restaurar en la pestaña Historial. Haz clic en "Restaurar esta Versión" en esa tarjeta de versión.\n\nEl proyecto revertirá al estado guardado — todas las áreas, gabinetes, materiales y costos de esa instantánea serán restaurados.\n\nSe guarda automáticamente una nueva versión antes de la restauración, por si necesitas deshacer la restauración.',
            },
          },
          {
            id: 'history-auto-save',
            label: { en: 'When are versions automatically saved?', es: '¿Cuándo se guardan las versiones automáticamente?' },
            answer: {
              en: 'Versions are automatically saved when:\n• A cabinet is added or deleted\n• Materials are changed (including bulk material changes)\n• A bulk price update is applied\n• The project status changes\n• Other significant modifications are made\n\nMinor edits like renaming an area or changing a quantity may not always trigger a new version.',
              es: 'Las versiones se guardan automáticamente cuando:\n• Se agrega o elimina un gabinete\n• Se cambian materiales (incluyendo cambios masivos)\n• Se aplica una actualización masiva de precios\n• Cambia el estado del proyecto\n• Se hacen otras modificaciones significativas\n\nEdiciones menores como renombrar un área o cambiar una cantidad pueden no siempre generar una nueva versión.',
            },
          },
        ],
      },
    ],
  },

  'project-management': {
    welcome: {
      en: 'You\'re on the Project Management tab. Here you can manage tasks, assign team members, and view the activity log. What do you need help with?',
      es: 'Estás en la pestaña Gestión de Proyecto. Aquí puedes gestionar tareas, asignar miembros del equipo y ver el registro de actividad. ¿En qué necesitas ayuda?',
    },
    categories: [
      {
        id: 'mgmt-tasks',
        label: { en: 'Tasks', es: 'Tareas' },
        questions: [
          {
            id: 'mgmt-add-task',
            label: { en: 'How do I add a task to this project?', es: '¿Cómo agrego una tarea a este proyecto?' },
            answer: {
              en: 'In the Tasks section, click "Add Task". Fill in:\n• Title (required)\n• Description (optional)\n• Due date\n• Assign to a team member\n\nClick Save. The task starts with "Pending" status.',
              es: 'En la sección Tareas, haz clic en "Agregar Tarea". Completa:\n• Título (requerido)\n• Descripción (opcional)\n• Fecha de vencimiento\n• Asignar a un miembro del equipo\n\nHaz clic en Guardar. La tarea inicia con estado "Pendiente".',
            },
            followups: ['mgmt-task-status'],
          },
          {
            id: 'mgmt-task-status',
            label: { en: 'How do I advance a task\'s status?', es: '¿Cómo avanzo el estado de una tarea?' },
            answer: {
              en: 'Click the status button on the task card to cycle through:\n• Pending → In Progress → Done\n\nThe status updates immediately. Completed tasks can be filtered or hidden depending on your view settings.',
              es: 'Haz clic en el botón de estado en la tarjeta de tarea para ciclar entre:\n• Pendiente → En Progreso → Completado\n\nEl estado se actualiza inmediatamente. Las tareas completadas se pueden filtrar u ocultar según la configuración de vista.',
            },
          },
          {
            id: 'mgmt-assign-task',
            label: { en: 'How do I assign a task to a team member?', es: '¿Cómo asigno una tarea a un miembro del equipo?' },
            answer: {
              en: 'When creating or editing a task, use the "Assign To" dropdown to select a team member. Only active team members configured in Settings → Team Members will appear in this list.',
              es: 'Al crear o editar una tarea, usa el desplegable "Asignar a" para seleccionar un miembro del equipo. Solo los miembros activos configurados en Configuración → Miembros del Equipo aparecerán en esta lista.',
            },
          },
        ],
      },
      {
        id: 'mgmt-bitacora',
        label: { en: 'Activity Log (Bitacora)', es: 'Registro de Actividad (Bitácora)' },
        questions: [
          {
            id: 'mgmt-what-bitacora',
            label: { en: 'What is the Bitacora?', es: '¿Qué es la Bitácora?' },
            answer: {
              en: 'The Bitacora is an activity log that records major project events — cabinet additions, material changes, status updates, price refreshes, and more.\n\nIt also supports manual entries so you can record meetings, decisions, or notes directly in the project history.',
              es: 'La Bitácora es un registro de actividad que registra eventos importantes del proyecto — adición de gabinetes, cambios de materiales, actualizaciones de estado, refrescamientos de precios, y más.\n\nTambién admite entradas manuales para que puedas registrar reuniones, decisiones o notas directamente en el historial del proyecto.',
            },
            followups: ['mgmt-add-bitacora'],
          },
          {
            id: 'mgmt-add-bitacora',
            label: { en: 'How do I add a manual log entry?', es: '¿Cómo agrego una entrada manual al registro?' },
            answer: {
              en: 'In the Bitacora section, click "Add Entry" or "Add Note". Enter your text (meeting notes, decisions, follow-ups, etc.) and click Save.\n\nManual entries appear alongside auto-generated entries in chronological order.',
              es: 'En la sección Bitácora, haz clic en "Agregar Entrada" o "Agregar Nota". Ingresa tu texto (notas de reunión, decisiones, seguimientos, etc.) y haz clic en Guardar.\n\nLas entradas manuales aparecen junto con las entradas generadas automáticamente en orden cronológico.',
            },
          },
        ],
      },
      {
        id: 'mgmt-docs',
        label: { en: 'Schedule & Documentation', es: 'Cronograma y Documentación' },
        questions: [
          {
            id: 'mgmt-schedule',
            label: {
              en: 'How do I set up a project schedule?',
              es: '¿Cómo configuro un cronograma de proyecto?',
            },
            answer: {
              en: 'The Schedule section in the Project Management tab lets you set key milestone dates:\n• Quote sent date\n• Approval / deposit date\n• Production start date\n• Estimated delivery date\n• Installation date\n\nDates are saved per project and help the team track where each project is in the workflow.',
              es: 'La sección Cronograma en la pestaña Gestión de Proyecto permite establecer fechas clave:\n• Fecha de envío de cotización\n• Fecha de aprobación / depósito\n• Fecha de inicio de producción\n• Fecha estimada de entrega\n• Fecha de instalación\n\nLas fechas se guardan por proyecto y ayudan al equipo a rastrear en qué punto del flujo se encuentra cada proyecto.',
            },
          },
          {
            id: 'mgmt-documentation',
            label: {
              en: 'What is the Documentation section?',
              es: '¿Qué es la sección de Documentación?',
            },
            answer: {
              en: 'The Documentation section lets you attach notes, links, or reference information to a project — such as architectural drawing revision notes, client specification documents, or supplier contacts.\n\nEntries are stored chronologically and visible to all team members with project access.',
              es: 'La sección de Documentación permite adjuntar notas, enlaces o información de referencia al proyecto — como notas de revisión de planos, documentos de especificaciones del cliente o datos de proveedores.\n\nLas entradas se almacenan cronológicamente y son visibles para todos los miembros del equipo con acceso al proyecto.',
            },
          },
        ],
      },
    ],
  },

  prices: {
    welcome: {
      en: 'Hi! I can help you understand the price list — how to manage materials, hardware, edgebanding, and how pricing affects project costs. What do you need?',
      es: '¡Hola! Puedo ayudarte a entender la lista de precios — cómo gestionar materiales, herrajes, canteado y cómo los precios afectan los costos del proyecto. ¿Qué necesitas?',
    },
    categories: [
      {
        id: 'price-types',
        label: { en: 'Item Types', es: 'Tipos de Ítems' },
        questions: [
          {
            id: 'price-list-types',
            label: { en: 'What types of items are in the price list?', es: '¿Qué tipos de ítems hay en la lista de precios?' },
            answer: {
              en: 'The price list has these categories:\n• Sheet Materials — box/carcass materials, door materials, interior finishes, back panels (priced per sheet; each sheet has a configured SF value)\n• Edgebanding — edge tape rolls (priced per meter; typically 50m per roll)\n• Hardware — handles, hinges, drawer slides, soft-close mechanisms, etc.\n• Door Profiles — premium door edge treatments\n• Accessories — optional add-ons (pull-outs, organizers, etc.)\n• Other — installation labor, delivery, miscellaneous items',
              es: 'La lista de precios tiene estas categorías:\n• Materiales en Lámina — materiales de caja/carcasa, puertas, acabados interiores, paneles traseros (precio por lámina; cada lámina tiene un valor de SF configurado)\n• Canteado — rollos de cinta de canto (precio por metro; típicamente 50m por rollo)\n• Herrajes — jaladores, bisagras, correderas, mecanismos de cierre suave, etc.\n• Perfiles de Puerta — tratamientos premium de cantos de puerta\n• Accesorios — complementos opcionales (cajones pull-out, organizadores, etc.)\n• Otros — mano de obra de instalación, entrega, ítems varios',
            },
          },
          {
            id: 'sf-per-sheet',
            label: { en: 'What is "SF per sheet"?', es: '¿Qué son los "SF por lámina"?' },
            answer: {
              en: '"SF per sheet" is the usable square footage of one sheet of material. For example, a standard 4×8 ft sheet = 32 SF, but accounting for trim waste it might be set to 30 SF. This value is used in all cabinet cost calculations to determine how many sheets are needed.',
              es: '"SF por lámina" es el área utilizable de una lámina de material en pies cuadrados. Por ejemplo, una lámina estándar de 4×8 pies = 32 SF, pero considerando el desperdicio por corte podría establecerse en 30 SF. Este valor se usa en todos los cálculos de costo de gabinetes para determinar cuántas láminas se necesitan.',
            },
          },
          {
            id: 'edgeband-rolls',
            label: { en: 'How are edgeband rolls calculated?', es: '¿Cómo se calculan los rollos de canteado?' },
            answer: {
              en: 'The system assumes 50 linear meters per roll. It calculates total meters needed across all cabinets and rounds up to the nearest whole roll for procurement purposes.\n\nFor example, if a project needs 73 meters → 2 rolls (100 meters will be ordered).',
              es: 'El sistema asume 50 metros lineales por rollo. Calcula el total de metros necesarios en todos los gabinetes y redondea al rollo completo más cercano para fines de compra.\n\nPor ejemplo, si un proyecto necesita 73 metros → 2 rollos (se pedirán 100 metros).',
            },
          },
        ],
      },
      {
        id: 'price-management',
        label: { en: 'Managing Prices', es: 'Gestionar Precios' },
        questions: [
          {
            id: 'add-price-item',
            label: { en: 'How do I add a new price list item?', es: '¿Cómo agrego un nuevo ítem a la lista de precios?' },
            answer: {
              en: 'Go to the Price List page → click "Add Item" → fill in:\n• Concept/description\n• Type (Sheet Material, Edgebanding, Hardware, etc.)\n• Unit (per sheet, per meter, per piece, etc.)\n• Price\n• SF per sheet (for sheet materials)\n• Notes (optional)\n\nThen click Save.',
              es: 'Ve a la página de Lista de Precios → haz clic en "Agregar Ítem" → completa:\n• Concepto/descripción\n• Tipo (Material en Lámina, Canteado, Herraje, etc.)\n• Unidad (por lámina, por metro, por pieza, etc.)\n• Precio\n• SF por lámina (para materiales en lámina)\n• Notas (opcional)\n\nLuego haz clic en Guardar.',
            },
          },
          {
            id: 'update-price',
            label: { en: 'How do I update a price?', es: '¿Cómo actualizo un precio?' },
            answer: {
              en: 'Go to the Price List page → find the item → click the edit (pencil) icon → change the price → Save.\n\nImportant: All projects using this material will automatically be flagged as "stale" so users know to review and update their project costs.',
              es: 'Ve a la página de Lista de Precios → encuentra el ítem → haz clic en el ícono de editar (lápiz) → cambia el precio → Guardar.\n\nImportante: Todos los proyectos que usan este material serán marcados automáticamente como "desactualizados" para que los usuarios sepan que deben revisar y actualizar los costos de sus proyectos.',
            },
          },
          {
            id: 'archive-price',
            label: { en: 'How do I remove or archive a price list item?', es: '¿Cómo elimino o archivo un ítem de la lista de precios?' },
            answer: {
              en: 'You cannot permanently delete price list items that are in use. Instead, you can archive them — this removes the item from dropdowns for new cabinets but doesn\'t affect existing project cabinets using it.\n\nTo archive: find the item on the Price List page and use the archive option.',
              es: 'No puedes eliminar permanentemente ítems de la lista de precios que están en uso. En su lugar, puedes archivarlos — esto elimina el ítem de los desplegables para nuevos gabinetes pero no afecta los gabinetes existentes en proyectos que lo usan.\n\nPara archivar: encuentra el ítem en la página de Lista de Precios y usa la opción de archivar.',
            },
          },
        ],
      },
    ],
  },

  products: {
    welcome: {
      en: 'Hi! I can help you with the products catalog — understanding SKUs, specifications, and how they work in quotations. What do you need?',
      es: '¡Hola! Puedo ayudarte con el catálogo de productos — entender SKUs, especificaciones y cómo funcionan en las cotizaciones. ¿Qué necesitas?',
    },
    categories: [
      {
        id: 'products-understand',
        label: { en: 'Understanding Products', es: 'Entender Productos' },
        questions: [
          {
            id: 'what-is-sku',
            label: { en: 'What is a product SKU?', es: '¿Qué es un SKU de producto?' },
            answer: {
              en: 'Each cabinet model has a unique SKU code that defines its specifications:\n• Box SF — how much box/carcass material the cabinet uses\n• Door/Fronts SF — how much door material it uses\n• Total edgeband meters — linear meters of edge tape needed\n• Has drawers — affects default labor cost\n• Boxes per unit — for modular/split cabinets\n• Custom labor cost — overrides the global labor setting\n• Default RTA flag — whether it\'s Ready-To-Assemble by default',
              es: 'Cada modelo de gabinete tiene un código SKU único que define sus especificaciones:\n• SF de Caja — cuánto material de caja/carcasa usa el gabinete\n• SF de Puertas/Frentes — cuánto material de puertas usa\n• Metros totales de canteado — metros lineales de cinta de canto necesarios\n• Tiene cajones — afecta el costo de mano de obra predeterminado\n• Cajas por unidad — para gabinetes modulares\n• Costo de mano de obra personalizado — sobreescribe la configuración global de mano de obra\n• Marca RTA predeterminada — si es Listo Para Ensamblar por defecto',
            },
          },
          {
            id: 'box-sf-meaning',
            label: { en: 'What does "Box SF" mean for a product?', es: '¿Qué significa "SF de Caja" en un producto?' },
            answer: {
              en: '"Box SF" is the total square footage of sheet material needed to build the cabinet carcass (the box/body, not including doors). It\'s used together with the selected box material\'s price per sheet and SF per sheet value to calculate the box material cost for each unit.',
              es: '"SF de Caja" es el total de pies cuadrados de material en lámina necesario para construir la carcasa del gabinete (la caja/cuerpo, sin incluir puertas). Se usa junto con el precio por lámina y el valor de SF por lámina del material de caja seleccionado para calcular el costo de material de caja por unidad.',
            },
          },
        ],
      },
      {
        id: 'products-manage',
        label: { en: 'Managing Products', es: 'Gestionar Productos' },
        questions: [
          {
            id: 'add-product',
            label: { en: 'How do I add a new product to the catalog?', es: '¿Cómo agrego un nuevo producto al catálogo?' },
            answer: {
              en: 'Go to Products Catalog → click "Add Product" → fill in:\n• SKU code\n• Description\n• Box SF (square footage of box material)\n• Door SF (square footage of door material)\n• Edgeband meters\n• Has drawers (yes/no)\n• Default RTA flag\n• Custom labor cost (optional, overrides global setting)\n\nThen click Save.',
              es: 'Ve al Catálogo de Productos → haz clic en "Agregar Producto" → completa:\n• Código SKU\n• Descripción\n• SF de Caja (pies cuadrados de material de caja)\n• SF de Puertas (pies cuadrados de material de puertas)\n• Metros de canteado\n• Tiene cajones (sí/no)\n• Marca RTA predeterminada\n• Costo de mano de obra personalizado (opcional, sobreescribe configuración global)\n\nLuego haz clic en Guardar.',
            },
          },
          {
            id: 'edit-product-warning',
            label: { en: 'What happens if I edit a product used in active projects?', es: '¿Qué pasa si edito un producto en uso en proyectos activos?' },
            answer: {
              en: 'The system checks if the product is used in any active projects. If it is, it shows you which projects are affected and warns you.\n\nChanges to a product\'s specs only affect future uses — existing cabinet instances in projects are NOT retroactively changed. So you can safely update a SKU without affecting already-quoted projects.',
              es: 'El sistema verifica si el producto está en uso en proyectos activos. Si lo está, te muestra qué proyectos se ven afectados y te advierte.\n\nLos cambios en las especificaciones de un producto solo afectan usos futuros — las instancias de gabinetes existentes en proyectos NO se cambian retroactivamente. Por lo tanto, puedes actualizar un SKU de forma segura sin afectar proyectos ya cotizados.',
            },
          },
          {
            id: 'archive-product',
            label: { en: 'How do I archive/retire a product?', es: '¿Cómo archivo/retiro un producto?' },
            answer: {
              en: 'On the Products Catalog page, find the product and click "Archive". It becomes inactive and won\'t appear in dropdowns when adding new cabinets. Existing project cabinets using this SKU are unaffected.',
              es: 'En la página del Catálogo de Productos, encuentra el producto y haz clic en "Archivar". Se vuelve inactivo y no aparecerá en los desplegables al agregar nuevos gabinetes. Los gabinetes existentes en proyectos que usan este SKU no se ven afectados.',
            },
          },
        ],
      },
      {
        id: 'products-calculator',
        label: { en: 'Dimension Calculator', es: 'Calculadora de Dimensiones' },
        questions: [
          {
            id: 'calc-what-is',
            label: {
              en: 'What is the Auto-calculate from Dimensions tool?',
              es: '¿Qué es la herramienta de Calcular desde Dimensiones?',
            },
            answer: {
              en: 'When creating or editing a product, there is a collapsible "📐 Auto-calculate from dimensions" section above Box Construction. It automatically computes all 6 material values from the cabinet\'s physical dimensions:\n• Box Square Feet\n• Box Edgeband (m)\n• Box Edgeband Color (m)\n• Doors & Fronts Square Feet\n• Doors Edgeband (m)\n• Total Edgeband (m)\n\nThis eliminates manual calculation from the cut-list spreadsheet.',
              es: 'Al crear o editar un producto, hay una sección colapsable "📐 Calcular desde dimensiones" sobre la sección de Construcción de Caja. Calcula automáticamente los 6 valores de material a partir de las dimensiones físicas del gabinete:\n• Pies Cuadrados de Caja\n• Canteado de Caja (m)\n• Canteado de Caja Color (m)\n• Pies Cuadrados de Puertas y Frentes\n• Canteado de Puertas (m)\n• Canteado Total (m)\n\nEsto elimina el cálculo manual desde la hoja de corte.',
            },
            followups: ['calc-how-use', 'calc-cabinet-types'],
          },
          {
            id: 'calc-how-use',
            label: {
              en: 'How do I use the dimension calculator?',
              es: '¿Cómo uso la calculadora de dimensiones?',
            },
            answer: {
              en: '1. Click "📐 Auto-calculate from dimensions" to expand the panel\n2. Enter Height, Width, Depth in inches\n3. Set Costados — default 2 for a standard box; increase for interior dividers\n4. Set number of Shelves (Entrepaños)\n5. Check "Has Doors" → enter number of doors\n6. Check "Has Drawers" → enter number of drawers\n7. Click "⚡ Calculate & Fill Fields"\n\nAll 6 fields fill automatically with a green highlight. You can still edit any field manually after calculation.',
              es: '1. Haz clic en "📐 Calcular desde dimensiones" para expandir el panel\n2. Ingresa Alto, Ancho, Fondo en pulgadas\n3. Establece Costados — predeterminado 2 para caja estándar; aumenta para divisores interiores\n4. Establece el número de Entrepaños\n5. Marca "Tiene Puertas" → ingresa la cantidad\n6. Marca "Tiene Cajones" → ingresa la cantidad\n7. Haz clic en "⚡ Calcular y Llenar Campos"\n\nLos 6 campos se llenan automáticamente con resaltado verde. Puedes editar cualquier campo manualmente después.',
            },
          },
          {
            id: 'calc-cabinet-types',
            label: {
              en: 'How does the calculator handle different cabinet types?',
              es: '¿Cómo maneja la calculadora los distintos tipos de gabinete?',
            },
            answer: {
              en: 'The calculator covers all 3 configurations:\n\n• Open Box — sides, back, top/bottom, and shelves only\n\n• With Doors — adds door panel SF and full door perimeter edgeband. Door width = cabinet width ÷ number of doors\n\n• With Drawers (Cajonero) — adds drawer box parts using Blum standard: drawer box height is fixed at 7" regardless of drawer count. Front height = cabinet height ÷ number of drawers\n\n• Mixed (doors + drawers) — use "Door Section Height" and "Drawer Section Height" to split the cabinet height between both.',
              es: 'La calculadora cubre las 3 configuraciones:\n\n• Open Box — costados, trasero, techo/piso y entrepaños únicamente\n\n• Con Puertas — agrega SF de puertas y canteado de perímetro completo. Ancho de puerta = ancho del gabinete ÷ número de puertas\n\n• Con Cajones (Cajonero) — agrega piezas de caja de cajón usando estándar Blum: la altura de la caja es fija en 7" sin importar la cantidad. Altura del frente = alto del gabinete ÷ número de cajones\n\n• Mixto (puertas + cajones) — usa "Alto Sección Puertas" y "Alto Sección Cajones" para distribuir la altura del gabinete.',
            },
          },
          {
            id: 'calc-collections',
            label: {
              en: 'What are product Collections / Libraries?',
              es: '¿Qué son las Colecciones / Bibliotecas de productos?',
            },
            answer: {
              en: 'Collections are custom groupings of products in the catalog — for example: "2026 Catalog", "Premium Line", "RTA Line".\n\nAssign a product to a collection in the "Collection / Library" dropdown when creating or editing it. On the Products Catalog page, use the collection filter to browse only products from a specific line.\n\nCollections help organize large catalogs and speed up SKU search during quotation.',
              es: 'Las colecciones son agrupaciones personalizadas de productos en el catálogo — por ejemplo: "Catálogo 2026", "Línea Premium", "Línea RTA".\n\nAsigna un producto a una colección en el desplegable "Colección / Biblioteca" al crearlo o editarlo. En la página del Catálogo de Productos, usa el filtro de colección para ver solo los productos de una línea específica.\n\nLas colecciones ayudan a organizar catálogos grandes y agilizan la búsqueda de SKU durante la cotización.',
            },
          },
          {
            id: 'calc-from-project',
            label: {
              en: 'Can I create a product without going to Products Catalog?',
              es: '¿Puedo crear un producto sin ir al Catálogo de Productos?',
            },
            answer: {
              en: 'To add a product SKU to the catalog, go to Products Catalog → Add Product. The form includes the dimension calculator to compute all values automatically.\n\nTo add a cabinet directly to a project without leaving it, use "Create Cabinet" in the floating action bar (☰, bottom-right). This opens the cabinet form as an overlay and adds the cabinet immediately once saved.',
              es: 'Para agregar un SKU de producto al catálogo, ve a Catálogo de Productos → Agregar Producto. El formulario incluye la calculadora de dimensiones para calcular todos los valores automáticamente.\n\nPara agregar un gabinete directamente a un proyecto sin salir de él, usa "Crear Gabinete" en la barra de acción flotante (☰, esquina inferior derecha). Esto abre el formulario de gabinete como superposición y lo agrega de inmediato al guardar.',
            },
          },
        ],
      },
    ],
  },

  templates: {
    welcome: {
      en: 'Hi! I can help you with templates — saving, loading, and managing cabinet configurations. What do you need?',
      es: '¡Hola! Puedo ayudarte con las plantillas — guardar, cargar y gestionar configuraciones de gabinetes. ¿Qué necesitas?',
    },
    categories: [
      {
        id: 'templates-use',
        label: { en: 'Using Templates', es: 'Usar Plantillas' },
        questions: [
          {
            id: 'what-is-template',
            label: { en: 'What is a template?', es: '¿Qué es una plantilla?' },
            answer: {
              en: 'A template is a saved cabinet configuration — it captures the SKU and all your choices: box material, door material, edgebanding, back panel, door profile, hardware list, and accessories.\n\nTemplates speed up quotation by letting you re-use proven designs without selecting all fields from scratch each time.',
              es: 'Una plantilla es una configuración guardada de gabinete — captura el SKU y todas tus elecciones: material de caja, material de puertas, canteado, panel trasero, perfil de puerta, lista de herrajes y accesorios.\n\nLas plantillas agilizan la cotización al permitirte reutilizar diseños probados sin seleccionar todos los campos desde cero cada vez.',
            },
          },
          {
            id: 'save-template-from',
            label: { en: 'How do I save a cabinet as a template?', es: '¿Cómo guardo un gabinete como plantilla?' },
            answer: {
              en: '1. Open a project in Project Details\n2. Find a cabinet you want to save\n3. Click "Save as Template" on the cabinet card\n4. Enter a name, description, and category (Base, Wall, Tall, Specialty, etc.)\n5. Click Save\n\nThe template now appears on the Templates page.',
              es: '1. Abre un proyecto en Detalles del Proyecto\n2. Encuentra el gabinete que quieres guardar\n3. Haz clic en "Guardar como Plantilla" en la tarjeta del gabinete\n4. Ingresa un nombre, descripción y categoría (Base, Aéreo, Alto, Especial, etc.)\n5. Haz clic en Guardar\n\nLa plantilla ahora aparece en la página de Plantillas.',
            },
          },
          {
            id: 'load-template',
            label: { en: 'How do I load a template when adding a cabinet?', es: '¿Cómo cargo una plantilla al agregar un gabinete?' },
            answer: {
              en: 'When adding a cabinet to an area:\n1. Click "Load from Template" (or the template selector icon)\n2. Browse or search templates by name or category\n3. Select a template\n4. All fields (SKU, materials, hardware, accessories) are pre-filled\n5. Modify any field as needed for this project\n6. Click Save\n\nThe system warns you if any referenced materials are archived.',
              es: 'Al agregar un gabinete a un área:\n1. Haz clic en "Cargar Plantilla" (o el ícono del selector de plantillas)\n2. Navega o busca plantillas por nombre o categoría\n3. Selecciona una plantilla\n4. Todos los campos (SKU, materiales, herrajes, accesorios) se prellenan\n5. Modifica cualquier campo según sea necesario para este proyecto\n6. Haz clic en Guardar\n\nEl sistema te advierte si algún material referenciado está archivado.',
            },
          },
          {
            id: 'template-categories',
            label: { en: 'What template categories are available?', es: '¿Qué categorías de plantillas están disponibles?' },
            answer: {
              en: 'Templates can be organized into these categories:\n• Base Cabinets\n• Wall Cabinets\n• Tall Cabinets\n• Specialty\n• Accessories\n• General\n\nYou can filter by category on the Templates page.',
              es: 'Las plantillas se pueden organizar en estas categorías:\n• Gabinetes de Base\n• Gabinetes Aéreos\n• Gabinetes Altos\n• Especiales\n• Accesorios\n• General\n\nPuedes filtrar por categoría en la página de Plantillas.',
            },
          },
          {
            id: 'template-validation',
            label: { en: 'Why does a template show a validation warning?', es: '¿Por qué una plantilla muestra una advertencia de validación?' },
            answer: {
              en: 'A validation warning appears when one or more materials or products referenced in the template have been archived or deleted.\n\nYou can still load the template, but you\'ll need to update those fields before saving. The warning shows exactly which items are no longer active.',
              es: 'Una advertencia de validación aparece cuando uno o más materiales o productos referenciados en la plantilla han sido archivados o eliminados.\n\nAún puedes cargar la plantilla, pero necesitarás actualizar esos campos antes de guardar. La advertencia muestra exactamente qué ítems ya no están activos.',
            },
          },
        ],
      },
    ],
  },

  settings: {
    welcome: {
      en: 'Hi! I can help you configure the system — labor costs, waste percentages, exchange rate, team members, and more. What do you need?',
      es: '¡Hola! Puedo ayudarte a configurar el sistema — costos de mano de obra, porcentajes de desperdicio, tipo de cambio, miembros del equipo y más. ¿Qué necesitas?',
    },
    categories: [
      {
        id: 'settings-costs',
        label: { en: 'Labor & Waste', es: 'Mano de Obra y Desperdicio' },
        questions: [
          {
            id: 'labor-costs',
            label: { en: 'How do I configure labor costs?', es: '¿Cómo configuro los costos de mano de obra?' },
            answer: {
              en: 'In Settings → Labor Costs:\n• Simple cabinet (no drawers): default MX$400\n• Cabinet with drawers: default MX$600\n• Accessories: default MX$100 per accessory item\n\nThese are global defaults. Individual SKUs in the Products Catalog can override them with a custom labor cost.',
              es: 'En Configuración → Costos de Mano de Obra:\n• Gabinete simple (sin cajones): predeterminado MX$400\n• Gabinete con cajones: predeterminado MX$600\n• Accesorios: predeterminado MX$100 por accesorio\n\nEstos son valores predeterminados globales. Los SKUs individuales en el Catálogo de Productos pueden sobreescribirlos con un costo de mano de obra personalizado.',
            },
          },
          {
            id: 'waste-percentages',
            label: { en: 'How do waste percentages work?', es: '¿Cómo funcionan los porcentajes de desperdicio?' },
            answer: {
              en: 'In Settings → Waste:\n• Box material waste: default 10%\n• Door material waste: default 10%\n\nThese are applied globally to all new cabinets. For example, if a cabinet needs 10 SF of box material and waste is 10%, the system calculates cost for 11 SF.\n\nYou can apply updated waste % to all existing project cabinets using the "Apply Waste" button in Settings.',
              es: 'En Configuración → Desperdicio:\n• Desperdicio de material de caja: predeterminado 10%\n• Desperdicio de material de puertas: predeterminado 10%\n\nEstos se aplican globalmente a todos los nuevos gabinetes. Por ejemplo, si un gabinete necesita 10 SF de material de caja y el desperdicio es 10%, el sistema calcula el costo para 11 SF.\n\nPuedes aplicar el % de desperdicio actualizado a todos los gabinetes existentes usando el botón "Aplicar Desperdicio" en Configuración.',
            },
          },
        ],
      },
      {
        id: 'settings-currency',
        label: { en: 'Currency & Exchange Rate', es: 'Moneda y Tipo de Cambio' },
        questions: [
          {
            id: 'exchange-rate',
            label: { en: 'How do I update the USD/MXN exchange rate?', es: '¿Cómo actualizo el tipo de cambio USD/MXN?' },
            answer: {
              en: 'Go to Settings → Currency and update the USD/MXN exchange rate. The default is 18:1 (MX$18 per USD).\n\nThis exchange rate is used whenever the system displays USD equivalents, including in PDF exports when USD is selected.',
              es: 'Ve a Configuración → Moneda y actualiza el tipo de cambio USD/MXN. El predeterminado es 18:1 (MX$18 por dólar).\n\nEste tipo de cambio se usa siempre que el sistema muestra equivalentes en USD, incluyendo en exportaciones PDF cuando se selecciona USD.',
            },
          },
        ],
      },
      {
        id: 'settings-team',
        label: { en: 'Team Members', es: 'Miembros del Equipo' },
        questions: [
          {
            id: 'add-team-member',
            label: { en: 'How do I add a team member?', es: '¿Cómo agrego un miembro al equipo?' },
            answer: {
              en: 'Go to Settings → Team Members → click "Add Member".\nFill in: name, role, email.\nSet as active/inactive and configure display order.\n\nTeam members appear in task assignment dropdowns when managing project tasks.',
              es: 'Ve a Configuración → Miembros del Equipo → haz clic en "Agregar Miembro".\nCompleta: nombre, rol, correo electrónico.\nEstablece como activo/inactivo y configura el orden de visualización.\n\nLos miembros del equipo aparecen en los desplegables de asignación de tareas al gestionar las tareas del proyecto.',
            },
          },
        ],
      },
      {
        id: 'settings-custom',
        label: { en: 'Custom Types & Units', es: 'Tipos y Unidades Personalizados' },
        questions: [
          {
            id: 'custom-types',
            label: { en: 'How do I add custom project types or units?', es: '¿Cómo agrego tipos de proyecto o unidades personalizados?' },
            answer: {
              en: 'In Settings:\n• Custom Project Types → Add types beyond the defaults (Custom, Bids, Prefab, Stores)\n• Custom Units → Add measurement units for price list items beyond the defaults\n\nThese appear in their respective dropdowns throughout the system.',
              es: 'En Configuración:\n• Tipos de Proyecto Personalizados → Agrega tipos más allá de los predeterminados (Custom, Bids, Prefab, Stores)\n• Unidades Personalizadas → Agrega unidades de medida para ítems de la lista de precios más allá de los predeterminados\n\nEstos aparecen en sus respectivos desplegables en todo el sistema.',
            },
          },
        ],
      },
      {
        id: 'settings-defaults',
        label: { en: 'Default Disclaimers', es: 'Avisos Predeterminados' },
        questions: [
          {
            id: 'default-disclaimers',
            label: { en: 'How do I change default PDF disclaimers?', es: '¿Cómo cambio los avisos predeterminados del PDF?' },
            answer: {
              en: 'In Settings → Disclaimers, you can update the default text for:\n• Tariff Disclaimer — explains any tariff/import duty charges on the PDF\n• Price Validity Disclaimer — explains how long the quote is valid\n\nThese defaults apply to new projects. Individual projects can override them in the project\'s Info tab.',
              es: 'En Configuración → Avisos, puedes actualizar el texto predeterminado para:\n• Aviso de Arancel — explica los cargos de arancel/impuesto de importación en el PDF\n• Aviso de Vigencia de Precios — explica por cuánto tiempo es válida la cotización\n\nEstos valores predeterminados aplican a nuevos proyectos. Los proyectos individuales pueden sobreescribirlos en la pestaña Info del proyecto.',
            },
          },
        ],
      },
    ],
  },
};
