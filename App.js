import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = 'https://prueva-1-wuwk.onrender.com';
const COLORS = {
  ink: '#292421', muted: '#77716D', canvas: '#F5F2EF', paper: '#FFFFFF',
  line: '#E9E3DE', wine: '#750D32', lime: '#D8E707', green: '#287755', red: '#A63338',
};
const MODULES = {
  categorias: { label: 'Categorías', list: '/api/categorias/categorias', item: '/api/categorias/categoria' },
  clientes: { label: 'Clientes', list: '/api/clientes/clientes', item: '/api/clientes/cliente' },
  productos: { label: 'Productos', list: '/api/productos/productos', item: '/api/productos/producto' },
  pedidos: { label: 'Pedidos', list: '/api/pedidos/pedidos', item: '/api/pedidos/pedido' },
  creditos: { label: 'Créditos', list: '/api/creditos/creditos', item: '/api/creditos/credito' },
};
const TABS = [
  { id: 'home', label: 'Inicio' }, { id: 'catalog', label: 'Catálogo' },
  { id: 'orders', label: 'Pedidos' }, { id: 'history', label: 'Historial' },
  { id: 'profile', label: 'Perfil' },
];
const today = () => new Date().toISOString().slice(0, 10);
const recordId = record => record?.id || record?._id || '';
const referenceId = value => {
  if (typeof value === 'string') return value.split('/').pop();
  return recordId(value);
};
const formatMoney = value => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(Number(value) || 0);

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { mensaje: text }; }
  if (!response.ok) throw new Error(data.mensaje || data.message || `Error ${response.status}`);
  return data;
}

function createForm(entity, record, records) {
  if (record) {
    const form = { ...record, image: null };
    ['clienteRef', 'productoRef', 'categoriaRef', 'usuarioRef'].forEach(key => {
      if (form[key]) form[key] = referenceId(form[key]);
    });
    if (Array.isArray(form.detalles)) {
      form.detalles = form.detalles.map(row => ({ ...row, productoRef: referenceId(row.productoRef) }));
    }
    return form;
  }
  const forms = {
    categorias: { nombre: '', descripcion: '', image: null },
    clientes: { nombre: '', telefono: '', direccion: '', estado: true },
    productos: { nombre: '', descripcion: '', precio: '', stock: '', categoriaRef: recordId(records.categorias[0]), estado: true, image: null },
    pedidos: {
      clienteRef: recordId(records.clientes[0]), fecha: today(), estado: false, metodoPago: true,
      detalles: [{ productoRef: recordId(records.productos[0]), cantidad: '1', precio: records.productos[0]?.precio || '' }],
    },
    creditos: {
      clienteRef: recordId(records.clientes[0]), productoRef: recordId(records.productos[0]),
      fecha: today(), descripcion: '', montoTotal: '', saldoPendiente: '', estado: false,
      abonos: [{ fecha: today(), monto: '' }],
    },
  };
  return forms[entity];
}

function Button({ label, onPress, quiet = false, disabled = false }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, quiet && styles.buttonQuiet, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.buttonText, quiet && styles.buttonQuietText]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.actionText}>{action}</Text></Pressable> : null}</View>;
}

function EmptyState() {
  return <View style={styles.empty}><Text style={styles.emptyMark}>—</Text><Text style={styles.emptyTitle}>Todavía no hay registros</Text><Text style={styles.emptyText}>Cuando agregues uno, aparecerá aquí.</Text></View>;
}

function RecordRow({ entity, record, onEdit }) {
  let subtitle = record.descripcion || '';
  if (entity === 'productos') subtitle = `${formatMoney(record.precio)} · ${record.stock ?? 0} en inventario`;
  if (entity === 'clientes') subtitle = `${record.telefono || 'Sin teléfono'} · ${record.direccion || 'Sin dirección'}`;
  if (entity === 'pedidos') subtitle = `${record.fecha || 'Sin fecha'} · ${formatMoney(record.total)} · ${record.estado ? 'Completado' : 'En proceso'}`;
  if (entity === 'creditos') subtitle = `${record.fecha || 'Sin fecha'} · Pendiente ${formatMoney(record.saldoPendiente)}`;
  const imageUrl = record.imagenUrl || record.imagen;
  return (
    <View style={styles.recordRow}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.recordImage} /> : null}
      <View style={styles.recordCopy}><Text numberOfLines={1} style={styles.recordName}>{record.nombre || record.descripcion || MODULES[entity].label}</Text><Text numberOfLines={2} style={styles.recordDetail}>{subtitle}</Text></View>
      <Pressable onPress={onEdit} style={styles.editButton}><Text style={styles.editText}>Editar</Text></Pressable>
    </View>
  );
}

export default function App() {
  const [records, setRecords] = useState({ categorias: [], clientes: [], productos: [], pedidos: [], creditos: [] });
  const [screen, setScreen] = useState('home');
  const [catalogKind, setCatalogKind] = useState('productos');
  const [historyKind, setHistoryKind] = useState('pedidos');
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    const modules = Object.entries(MODULES);
    const results = await Promise.allSettled(modules.map(([, config]) => apiRequest(config.list)));
    const next = {};
    const unavailable = [];
    results.forEach((result, index) => {
      const key = modules[index][0];
      if (result.status === 'fulfilled' && Array.isArray(result.value)) next[key] = result.value;
      else { next[key] = []; unavailable.push(MODULES[key].label); }
    });
    setRecords(next);
    setError(unavailable.length ? `No se pudieron cargar: ${unavailable.join(', ')}.` : '');
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function openEditor(entity, record = null) {
    setNotice(''); setError('');
    setEditor({ entity, record, form: createForm(entity, record, records) });
  }

  function setFormValue(key, value) {
    setEditor(current => ({ ...current, form: { ...current.form, [key]: value } }));
  }

  async function chooseImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled) setFormValue('image', result.assets[0]);
  }

  function totalFor(details = []) {
    return details.reduce((total, row) => total + (Number(row.cantidad) || 0) * (Number(row.precio) || 0), 0);
  }

  async function saveRecord() {
    if (!editor) return;
    const { entity, record, form } = editor;
    const multipart = entity === 'categorias' || entity === 'productos';
    if (multipart && !record && !form.image) {
      setError('Selecciona una imagen para continuar.');
      return;
    }
    if (entity === 'pedidos' && (!form.clienteRef || !form.detalles?.length || form.detalles.some(row => !row.productoRef))) { setError('Elige un cliente y al menos un producto.'); return; }
    if (entity === 'creditos' && (!form.clienteRef || !form.productoRef)) { setError('Elige un cliente y un producto.'); return; }
    if (entity === 'creditos' && form.abonos?.some(row => !row.fecha || Number(row.monto) <= 0)) { setError('Cada abono necesita fecha y un monto mayor que cero.'); return; }
    setSaving(true); setError('');
    try {
      const config = MODULES[entity];
      const payload = { ...form };
      delete payload.image;
      if (entity === 'pedidos') {
        payload.detalles = payload.detalles.map(row => ({
          ...row,
          subtotal: (Number(row.cantidad) || 0) * (Number(row.precio) || 0),
        }));
        payload.total = totalFor(payload.detalles);
      }
      const headers = {};
      let body;
      if (multipart) {
        body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value != null) body.append(key, String(value));
        });
        if (form.image) {
          body.append('imagen', {
            uri: form.image.uri,
            name: form.image.fileName || `imagen-${Date.now()}.jpg`,
            type: form.image.mimeType || 'image/jpeg',
          });
        }
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(payload);
      }
      const path = `${config.item}${record ? `/${recordId(record)}` : ''}`;
      const result = await apiRequest(path, { method: record ? 'PUT' : 'POST', headers, body });
      setEditor(null); setNotice(result.mensaje || `${config.label} guardado correctamente.`);
      await refresh();
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar el registro.'); }
    finally { setSaving(false); }
  }

  function recordList(entity, limit) {
    const needle = search.trim().toLocaleLowerCase();
    const items = (records[entity] || []).filter(record => !needle || JSON.stringify(record).toLocaleLowerCase().includes(needle));
    if (loading) return <ActivityIndicator color={COLORS.wine} style={styles.loader} />;
    if (!items.length) return <EmptyState />;
    return items.slice(0, limit).map((record, index) => <RecordRow key={recordId(record) || `${entity}-${index}`} entity={entity} record={record} onEdit={() => openEditor(entity, record)} />);
  }

  const activeTab = screen === 'clients' ? 'profile' : screen;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.topbar}><View><Text style={styles.brand}>CHEVEZ <Text style={styles.brandAccent}>/</Text> MOBILE BI</Text><Text style={styles.topCaption}>GESTIÓN COMERCIAL</Text></View><Pressable onPress={refresh} accessibilityLabel="Actualizar datos" style={styles.refresh}><Text style={styles.refreshGlyph}>↻</Text></Pressable></View>
          {notice ? <Text style={styles.success}>{notice}</Text> : null}{error && !editor ? <Text style={styles.error}>{error}</Text> : null}

          {screen === 'home' ? <>
            <View style={styles.hero}><Text style={styles.eyebrow}>PANEL PRINCIPAL · EN LÍNEA</Text><Text style={styles.heroTitle}>Tu negocio,{ '\n' }en control.</Text><Text style={styles.heroCopy}>Inventario y operación diaria, en un solo lugar.</Text><View style={styles.heroFoot}><Text style={styles.heroFootLabel}>PEDIDOS REGISTRADOS</Text><Text style={styles.heroFootValue}>{records.pedidos.length.toString().padStart(2, '0')}</Text></View></View>
            <SectionTitle title="Resumen" action="Actualizar" onAction={refresh} />
            <View style={styles.stats}><View style={[styles.stat, styles.statDark]}><Text style={styles.statLabel}>PRODUCTOS</Text><Text style={[styles.statValue, styles.lightText]}>{records.productos.length}</Text><Text style={[styles.statNote, styles.lightText]}>En catálogo</Text></View><View style={[styles.stat, styles.statLime]}><Text style={styles.statLabel}>CLIENTES</Text><Text style={styles.statValue}>{records.clientes.length}</Text><Text style={styles.statNote}>Registrados</Text></View><View style={[styles.stat, styles.statPaper]}><Text style={styles.statLabel}>PEDIDOS</Text><Text style={styles.statValue}>{records.pedidos.length}</Text><Text style={styles.statNote}>En historial</Text></View><View style={[styles.stat, styles.statPaper]}><Text style={styles.statLabel}>CRÉDITO ACTIVO</Text><Text style={styles.statValueSmall}>{formatMoney(records.creditos.filter(item => !item.estado).reduce((sum, item) => sum + Number(item.saldoPendiente || 0), 0))}</Text><Text style={styles.statNote}>Saldo pendiente</Text></View></View>
            <SectionTitle title="Últimos pedidos" action="Ver todos" onAction={() => setScreen('orders')} />{recordList('pedidos', 3)}
          </> : null}

          {screen === 'catalog' ? <><View style={styles.intro}><Text style={styles.kicker}>INVENTARIO</Text><Text style={styles.title}>Catálogo</Text><Text style={styles.subtitle}>Productos y categorías en un mismo espacio.</Text></View><View style={styles.segment}>{['productos', 'categorias'].map(kind => <Pressable key={kind} onPress={() => { setCatalogKind(kind); setSearch(''); }} style={[styles.segmentOption, catalogKind === kind && styles.segmentActive]}><Text style={[styles.segmentText, catalogKind === kind && styles.segmentTextActive]}>{MODULES[kind].label}</Text></Pressable>)}</View><TextInput value={search} onChangeText={setSearch} placeholder="Buscar en el catálogo" placeholderTextColor={COLORS.muted} style={styles.search} /><View style={styles.actionRow}><Text style={styles.count}>{records[catalogKind].length} REGISTROS</Text><Button label={`+ ${catalogKind === 'productos' ? 'Producto' : 'Categoría'}`} onPress={() => openEditor(catalogKind)} /></View>{recordList(catalogKind)}</> : null}

          {screen === 'orders' ? <><View style={styles.intro}><Text style={styles.kicker}>OPERACIÓN</Text><Text style={styles.title}>Pedidos</Text><Text style={styles.subtitle}>Registra ventas y consulta su estado.</Text></View><View style={styles.actionRow}><Text style={styles.count}>{records.pedidos.length} PEDIDOS</Text><Button label="+ Nuevo pedido" onPress={() => openEditor('pedidos')} /></View><TextInput value={search} onChangeText={setSearch} placeholder="Buscar pedido" placeholderTextColor={COLORS.muted} style={styles.search} />{recordList('pedidos')}</> : null}

          {screen === 'history' ? <><View style={styles.intro}><Text style={styles.kicker}>MOVIMIENTOS</Text><Text style={styles.title}>Historial</Text><Text style={styles.subtitle}>Pedidos y créditos registrados.</Text></View><View style={styles.segment}>{['pedidos', 'creditos'].map(kind => <Pressable key={kind} onPress={() => { setHistoryKind(kind); setSearch(''); }} style={[styles.segmentOption, historyKind === kind && styles.segmentActive]}><Text style={[styles.segmentText, historyKind === kind && styles.segmentTextActive]}>{MODULES[kind].label}</Text></Pressable>)}</View><View style={styles.actionRow}><Text style={styles.count}>{records[historyKind].length} REGISTROS</Text>{historyKind === 'creditos' ? <Button label="+ Crédito" onPress={() => openEditor('creditos')} /> : null}</View><TextInput value={search} onChangeText={setSearch} placeholder="Buscar movimiento" placeholderTextColor={COLORS.muted} style={styles.search} />{recordList(historyKind)}</> : null}

          {screen === 'profile' ? <><View style={styles.intro}><Text style={styles.kicker}>CUENTA</Text><Text style={styles.title}>Perfil</Text><Text style={styles.subtitle}>Herramientas del espacio de trabajo.</Text></View><View style={styles.profile}><Text style={styles.monogram}>C</Text><View><Text style={styles.profileName}>Chevez Mobile BI</Text><Text style={styles.profileCaption}>PANEL DE GESTIÓN</Text></View></View><SectionTitle title="Administración" /><Pressable style={styles.menuRow} onPress={() => { setScreen('clients'); setSearch(''); }}><View><Text style={styles.menuName}>Clientes</Text><Text style={styles.menuCaption}>{records.clientes.length} registros</Text></View><Text style={styles.arrow}>›</Text></Pressable><Button label="+ Registrar cliente" onPress={() => openEditor('clientes')} /><SectionTitle title="Usuarios" /><View style={styles.note}><Text style={styles.menuName}>Módulo no disponible</Text><Text style={styles.menuCaption}>El backend todavía no tiene rutas ni operaciones para usuarios.</Text></View></> : null}

          {screen === 'clients' ? <><View style={styles.intro}><Pressable onPress={() => setScreen('profile')}><Text style={styles.kicker}>‹ PERFIL</Text></Pressable><Text style={styles.title}>Clientes</Text><Text style={styles.subtitle}>Contactos guardados en el negocio.</Text></View><View style={styles.actionRow}><Text style={styles.count}>{records.clientes.length} CLIENTES</Text><Button label="+ Nuevo cliente" onPress={() => openEditor('clientes')} /></View><TextInput value={search} onChangeText={setSearch} placeholder="Buscar cliente" placeholderTextColor={COLORS.muted} style={styles.search} />{recordList('clientes')}</> : null}
        </ScrollView>

        <View style={styles.tabBar}>{TABS.map((tab, index) => <Pressable key={tab.id} onPress={() => { setScreen(tab.id); setSearch(''); setNotice(''); setError(''); }} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.id }}><Text style={[styles.tabNumber, activeTab === tab.id && styles.tabActive]}>0{index + 1}</Text><Text style={[styles.tabLabel, activeTab === tab.id && styles.tabActive]}>{tab.label}</Text></Pressable>)}</View>
      </View>

      <Modal visible={Boolean(editor)} animationType="slide" onRequestClose={() => setEditor(null)}><SafeAreaView style={styles.modalSafe}><StatusBar style="dark" /><KeyboardAvoidingView style={styles.modalShell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modalHeader}><View><Text style={styles.kicker}>{editor?.record ? 'ACTUALIZAR' : 'NUEVO REGISTRO'}</Text><Text style={styles.modalTitle}>{MODULES[editor?.entity]?.label}</Text></View><Pressable onPress={() => setEditor(null)} accessibilityLabel="Cerrar formulario" style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">{editor ? <EditorFields editor={editor} setValue={setFormValue} chooseImage={chooseImage} totalFor={totalFor} records={records} /> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={saving ? 'Guardando…' : editor?.record ? 'Guardar cambios' : 'Registrar'} onPress={saveRecord} disabled={saving} /><Button label="Cancelar" onPress={() => setEditor(null)} quiet disabled={saving} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    </SafeAreaView>
  );
}

function EditorFields({ editor, setValue, chooseImage, totalFor, records }) {
  const { entity, record, form } = editor;
  const set = setValue;
  const definitions = {
    categorias: [{ key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción', multiline: true }],
    clientes: [{ key: 'nombre', label: 'Nombre' }, { key: 'telefono', label: 'Teléfono', keyboardType: 'phone-pad' }, { key: 'direccion', label: 'Dirección', multiline: true }, { key: 'estado', label: 'Estado', type: 'boolean', choices: [['Activo', true], ['Inactivo', false]] }],
    productos: [{ key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción', multiline: true }, { key: 'precio', label: 'Precio', keyboardType: 'decimal-pad' }, { key: 'stock', label: 'Existencias', keyboardType: 'number-pad' }, { key: 'categoriaRef', label: 'Categoría', type: 'reference', options: records.categorias }, { key: 'estado', label: 'Estado', type: 'boolean', choices: [['Activo', true], ['Inactivo', false]] }],
    creditos: [{ key: 'clienteRef', label: 'Cliente', type: 'reference', options: records.clientes }, { key: 'productoRef', label: 'Producto', type: 'reference', options: records.productos }, { key: 'fecha', label: 'Fecha', placeholder: 'AAAA-MM-DD' }, { key: 'descripcion', label: 'Descripción', multiline: true }, { key: 'montoTotal', label: 'Monto total', keyboardType: 'decimal-pad' }, { key: 'saldoPendiente', label: 'Saldo pendiente', keyboardType: 'decimal-pad' }, { key: 'estado', label: 'Estado', type: 'boolean', choices: [['Pendiente', false], ['Cancelado', true]] }],
  };

  if (entity === 'pedidos') return <>
    <Field field={{ key: 'clienteRef', label: 'Cliente', type: 'reference', options: records.clientes }} value={form.clienteRef} onChange={value => set('clienteRef', value)} />
    <Field field={{ key: 'fecha', label: 'Fecha', placeholder: 'AAAA-MM-DD' }} value={form.fecha} onChange={value => set('fecha', value)} />
    <Field field={{ key: 'estado', label: 'Estado', type: 'boolean', choices: [['En proceso', false], ['Completado', true]] }} value={form.estado} onChange={value => set('estado', value)} />
    <Field field={{ key: 'metodoPago', label: 'Pago', type: 'boolean', choices: [['Efectivo', true], ['Tarjeta', false]] }} value={form.metodoPago} onChange={value => set('metodoPago', value)} />
    <Text style={styles.fieldLabel}>Productos del pedido</Text>
    {(form.detalles || []).map((row, index) => <View key={`line-${index}`} style={styles.orderLine}><Field field={{ key: `product-${index}`, label: `Producto ${index + 1}`, type: 'reference', options: records.productos }} value={row.productoRef} onChange={value => { const next = [...form.detalles]; const product = records.productos.find(item => recordId(item) === value); next[index] = { ...next[index], productoRef: value, precio: product?.precio || '' }; set('detalles', next); }} /><View style={styles.inlineFields}><View style={styles.inlineField}><Field field={{ key: `quantity-${index}`, label: 'Cantidad', keyboardType: 'number-pad' }} value={row.cantidad} onChange={value => { const next = [...form.detalles]; next[index] = { ...next[index], cantidad: value }; set('detalles', next); }} /></View><View style={styles.inlineField}><Text style={styles.fieldLabel}>Precio</Text><TextInput editable={false} value={String(row.precio || '')} style={[styles.input, styles.readOnly]} /></View></View><View style={styles.lineFoot}><Text style={styles.lineTotal}>{formatMoney((Number(row.cantidad) || 0) * (Number(row.precio) || 0))}</Text>{form.detalles.length > 1 ? <Pressable onPress={() => set('detalles', form.detalles.filter((_, rowIndex) => rowIndex !== index))}><Text style={styles.removeText}>Quitar</Text></Pressable> : null}</View></View>)}
    <Button label="+ Agregar producto" quiet onPress={() => set('detalles', [...(form.detalles || []), { productoRef: '', cantidad: '1', precio: '' }])} /><View style={styles.total}><Text style={styles.totalLabel}>TOTAL DEL PEDIDO</Text><Text style={styles.totalValue}>{formatMoney(totalFor(form.detalles))}</Text></View>
  </>;

  return <>
    {(definitions[entity] || []).map(field => <Field key={field.key} field={field} value={form[field.key]} onChange={value => set(field.key, value)} />)}
    {entity === 'categorias' || entity === 'productos' ? <View style={styles.imageBlock}><Text style={styles.fieldLabel}>Imagen {record ? '(opcional al actualizar)' : '(obligatoria)'}</Text>{form.image?.uri || form.imagenUrl || form.imagen ? <Image source={{ uri: form.image?.uri || form.imagenUrl || form.imagen }} style={styles.preview} /> : null}<Button label={form.image ? 'Cambiar imagen' : 'Elegir de galería'} quiet onPress={chooseImage} /><Text style={styles.helper}>Se guardará en Supabase Storage y su enlace en Firebase.</Text></View> : null}
    {entity === 'creditos' ? <><Text style={styles.fieldLabel}>Abonos</Text>{(form.abonos || []).map((payment, index) => <View key={`payment-${index}`} style={styles.inlineFields}><View style={styles.inlineField}><Field field={{ key: `date-${index}`, label: 'Fecha' }} value={payment.fecha} onChange={value => { const next = [...form.abonos]; next[index] = { ...next[index], fecha: value }; set('abonos', next); }} /></View><View style={styles.inlineField}><Field field={{ key: `amount-${index}`, label: 'Monto', keyboardType: 'decimal-pad' }} value={payment.monto} onChange={value => { const next = [...form.abonos]; next[index] = { ...next[index], monto: value }; set('abonos', next); }} /></View></View>)}<Button label="+ Agregar abono" quiet onPress={() => set('abonos', [...(form.abonos || []), { fecha: today(), monto: '' }])} /></> : null}
  </>;
}

function Field({ field, value, onChange }) {
  if (field.type === 'boolean' || field.type === 'reference') {
    const options = field.type === 'reference' ? (field.options || []).map(item => [item.nombre || recordId(item), recordId(item)]) : field.choices;
    return <View style={styles.field}><Text style={styles.fieldLabel}>{field.label}</Text>{options?.length ? <View style={styles.choices}>{options.map(([label, option]) => <Pressable key={String(option)} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.choiceSelected]}><Text style={[styles.choiceText, value === option && styles.choiceTextSelected]}>{label}</Text></Pressable>)}</View> : <TextInput value={String(value || '')} onChangeText={onChange} placeholder="Registra primero una opción" placeholderTextColor={COLORS.muted} style={styles.input} />}</View>;
  }
  return <View style={styles.field}><Text style={styles.fieldLabel}>{field.label}</Text><TextInput value={value == null ? '' : String(value)} onChangeText={onChange} placeholder={field.placeholder} placeholderTextColor={COLORS.muted} keyboardType={field.keyboardType || 'default'} multiline={field.multiline} textAlignVertical={field.multiline ? 'top' : 'center'} style={[styles.input, field.multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.canvas }, shell: { flex: 1 }, page: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }, brand: { color: COLORS.ink, fontSize: 15, fontWeight: '900' }, brandAccent: { color: COLORS.wine }, topCaption: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 3 }, refresh: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' }, refreshGlyph: { color: COLORS.wine, fontSize: 24 },
  hero: { minHeight: 226, padding: 22, backgroundColor: COLORS.wine, borderRadius: 7, marginBottom: 25 }, eyebrow: { color: '#F4DDE5', fontSize: 10, fontWeight: '800' }, heroTitle: { color: COLORS.paper, fontSize: 32, lineHeight: 36, fontWeight: '800', marginTop: 20 }, heroCopy: { color: '#F0DAE2', fontSize: 13, marginTop: 8 }, heroFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderColor: '#FFFFFF44' }, heroFootLabel: { color: '#F4DDE5', fontSize: 9, fontWeight: '800' }, heroFootValue: { color: COLORS.lime, fontSize: 22, fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 13 }, sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' }, actionText: { color: COLORS.wine, fontSize: 12, fontWeight: '700' }, stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 }, stat: { width: '48.5%', minHeight: 108, padding: 14, borderRadius: 6, justifyContent: 'space-between' }, statDark: { backgroundColor: COLORS.ink }, statLime: { backgroundColor: COLORS.lime }, statPaper: { backgroundColor: COLORS.paper }, statLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800' }, statValue: { color: COLORS.ink, fontSize: 27, fontWeight: '800' }, statValueSmall: { color: COLORS.ink, fontSize: 18, fontWeight: '800' }, statNote: { color: COLORS.muted, fontSize: 11 }, lightText: { color: COLORS.paper },
  intro: { marginTop: 10, marginBottom: 20 }, kicker: { color: COLORS.wine, fontSize: 10, fontWeight: '800' }, title: { color: COLORS.ink, fontSize: 32, fontWeight: '800', marginTop: 6 }, subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 6, lineHeight: 19 }, segment: { flexDirection: 'row', padding: 4, borderRadius: 6, backgroundColor: '#EAE4DF', marginBottom: 14 }, segmentOption: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 4 }, segmentActive: { backgroundColor: COLORS.paper }, segmentText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, segmentTextActive: { color: COLORS.ink }, search: { height: 46, backgroundColor: COLORS.paper, borderRadius: 5, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, color: COLORS.ink, marginBottom: 10 }, actionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, gap: 8 }, count: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  button: { minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: COLORS.wine, marginBottom: 9 }, buttonText: { color: COLORS.paper, fontSize: 12, fontWeight: '800' }, buttonQuiet: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line }, buttonQuietText: { color: COLORS.ink }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.82 }, recordRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.paper, padding: 11, borderBottomWidth: 1, borderBottomColor: COLORS.line }, recordImage: { width: 52, height: 52, borderRadius: 4, marginRight: 12, backgroundColor: COLORS.canvas }, recordCopy: { flex: 1, paddingRight: 8 }, recordName: { color: COLORS.ink, fontSize: 14, fontWeight: '800' }, recordDetail: { color: COLORS.muted, fontSize: 11, marginTop: 5, lineHeight: 15 }, editButton: { padding: 8 }, editText: { color: COLORS.wine, fontSize: 11, fontWeight: '800' }, loader: { padding: 30 }, empty: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 22, backgroundColor: COLORS.paper, borderRadius: 6 }, emptyMark: { color: COLORS.wine, fontSize: 27, fontWeight: '800' }, emptyTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' }, emptyText: { color: COLORS.muted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  tabBar: { minHeight: 62, flexDirection: 'row', backgroundColor: COLORS.paper, borderTopWidth: 1, borderTopColor: COLORS.line, paddingHorizontal: 3 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 5 }, tabNumber: { color: '#B6ADA7', fontSize: 9, fontWeight: '800' }, tabLabel: { color: COLORS.muted, fontSize: 10, marginTop: 3 }, tabActive: { color: COLORS.wine, fontWeight: '800' },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.wine, padding: 18, borderRadius: 6, marginBottom: 20 }, monogram: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.lime, color: COLORS.wine, textAlign: 'center', textAlignVertical: 'center', fontSize: 21, fontWeight: '900', marginRight: 13, overflow: 'hidden' }, profileName: { color: COLORS.paper, fontSize: 15, fontWeight: '800' }, profileCaption: { color: '#F4DDE5', fontSize: 9, fontWeight: '700', marginTop: 5 }, menuRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.paper, borderBottomWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, marginBottom: 12 }, menuName: { color: COLORS.ink, fontSize: 14, fontWeight: '800' }, menuCaption: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, arrow: { color: COLORS.wine, fontSize: 24 }, note: { padding: 15, backgroundColor: COLORS.paper, borderLeftWidth: 3, borderLeftColor: COLORS.lime }, success: { padding: 12, backgroundColor: '#E6F2EA', color: COLORS.green, fontSize: 12, borderRadius: 5, marginBottom: 10 }, error: { padding: 12, backgroundColor: '#F8E9E8', color: COLORS.red, fontSize: 12, borderRadius: 5, marginBottom: 10 },
  modalSafe: { flex: 1, backgroundColor: COLORS.canvas }, modalShell: { flex: 1 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.paper, borderBottomWidth: 1, borderColor: COLORS.line }, modalTitle: { color: COLORS.ink, fontSize: 24, fontWeight: '800', marginTop: 4 }, close: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas }, closeText: { color: COLORS.ink, fontSize: 27, lineHeight: 29 }, form: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 }, field: { marginBottom: 14 }, fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }, input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, backgroundColor: COLORS.paper, color: COLORS.ink, fontSize: 14 }, multiline: { minHeight: 84, paddingTop: 12 }, readOnly: { color: COLORS.muted }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { minHeight: 38, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, backgroundColor: COLORS.paper }, choiceSelected: { backgroundColor: COLORS.wine, borderColor: COLORS.wine }, choiceText: { color: COLORS.ink, fontSize: 11, fontWeight: '700' }, choiceTextSelected: { color: COLORS.paper }, imageBlock: { marginBottom: 16 }, preview: { width: '100%', height: 170, borderRadius: 5, marginBottom: 10, backgroundColor: COLORS.line }, helper: { color: COLORS.muted, fontSize: 10, marginTop: 1 }, orderLine: { marginBottom: 11, padding: 12, backgroundColor: COLORS.paper, borderRadius: 5 }, inlineFields: { flexDirection: 'row', gap: 10 }, inlineField: { flex: 1 }, lineFoot: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }, lineTotal: { color: COLORS.ink, fontSize: 13, fontWeight: '800' }, removeText: { color: COLORS.red, fontSize: 11, fontWeight: '700' }, total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: COLORS.ink, borderRadius: 5, marginTop: 8, marginBottom: 16 }, totalLabel: { color: COLORS.paper, fontSize: 10, fontWeight: '800' }, totalValue: { color: COLORS.lime, fontSize: 20, fontWeight: '900' },
});
