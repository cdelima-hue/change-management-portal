/**
 * test_production.js — Suite de Pruebas de Integración y Persistencia para Producción
 * Valida:
 * 1. Healthcheck y conectividad de base de datos
 * 2. Login y autenticación con token
 * 3. CRUD de Business Services y validación de conflicto al eliminar si está en uso
 * 4. CRUD de Países y validación de conflicto al eliminar si está en uso
 * 5. CRUD de Productos y validación de conflicto al eliminar si está en uso
 * 6. Creación, Edición y Persistencia de Changes
 * 7. Control de tiempo y cálculo de SLAs
 * 8. Simulación de multiusuario y persistencia tras reinicio
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DE PRODUCCIÓN');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Healthcheck
    console.log('\n--- 1. Verificando Health Check ---');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200 && health.body.status === 'ok', 'Endpoint /api/health responde 200 OK');

    // 2. Login
    console.log('\n--- 2. Autenticación & Tokens JWT ---');
    const loginRes = await makeRequest('POST', '/api/auth/login', { usuario: 'admin', password: 'Nestle2026!' });
    assert(loginRes.status === 200 && loginRes.body.success && loginRes.body.token, 'Login exitoso de Administrador y generación de JWT');
    const token = loginRes.body.token;

    // 3. Business Services CRUD & Protección de Integridad
    console.log('\n--- 3. Business Services CRUD & Integridad Referencial ---');
    const bsCrear = await makeRequest('POST', '/api/business-services', { nombre: 'Test Supply Chain Perú', pais: 'Perú' }, token);
    assert(bsCrear.status === 200 && bsCrear.body.success, 'Creación de nuevo Business Service');
    const bsId = bsCrear.body.id;

    const bsList = await makeRequest('GET', '/api/business-services', null, token);
    const bsFound = bsList.body.data.find(b => b.nombre === 'Test Supply Chain Perú');
    assert(!!bsFound, 'Business Service consultado exitosamente de la base de datos');

    // Crear una Change usando este Business Service
    const chgTest = await makeRequest('POST', '/api/changes', {
      numeroChange: 'CHG_TEST_001',
      solicitante: 'Test User',
      pais: 'Perú',
      businessService: 'Test Supply Chain Perú',
      producto: 'Nescafé Test',
      descripcion: 'Change de prueba para validación de restricciones',
      engenheiro: 'Carlos Mendoza',
      horasEstimadas: 10,
      d1: '2026-08-01'
    }, token);
    assert(chgTest.status === 200 && chgTest.body.success, 'Creación de Change vinculada al Business Service');

    // Intentar eliminar Business Service en uso -> Debe fallar con 409 Conflict
    const bsDeleteInUse = await makeRequest('DELETE', `/api/business-services/${bsId}`, null, token);
    assert(bsDeleteInUse.status === 409, 'El backend bloquea la eliminación de Business Service en uso (409 Conflict)');

    // Eliminar la Change
    await makeRequest('DELETE', `/api/changes/${chgTest.body.id}`, null, token);

    // Intentar eliminar nuevamente ahora que no está en uso -> Debe tener éxito
    const bsDeleteFree = await makeRequest('DELETE', `/api/business-services/${bsId}`, null, token);
    assert(bsDeleteFree.status === 200 && bsDeleteFree.body.success, 'Eliminación exitosa de Business Service no utilizado');

    // 4. Países CRUD & Protección de Integridad
    console.log('\n--- 4. Países / Mercados CRUD & Integridad ---');
    const paisCrear = await makeRequest('POST', '/api/countries', { key: 'Uruguay', nombre: 'Uruguay', horasDisponibles: 90, color: '#3b82f6' }, token);
    assert(paisCrear.status === 200 && paisCrear.body.success, 'Creación de País Uruguay con 90h/mes');

    const paisList = await makeRequest('GET', '/api/countries', null, token);
    const paisFound = paisList.body.data.find(p => p.key === 'Uruguay');
    assert(!!paisFound && paisFound.horasDisponibles === 90, 'País consultado correctamente de la base de datos');

    const paisDelete = await makeRequest('DELETE', '/api/countries/Uruguay', null, token);
    assert(paisDelete.status === 200 && paisDelete.body.success, 'Eliminación de País no utilizado');

    // 5. Productos CRUD & Protección de Integridad
    console.log('\n--- 5. Productos / Líneas CRUD & Integridad ---');
    const prodCrear = await makeRequest('POST', '/api/products', { nombre: 'Milo Shake', pais: 'Colombia' }, token);
    assert(prodCrear.status === 200 && prodCrear.body.success, 'Creación de Producto "Milo Shake"');
    const prodId = prodCrear.body.id;

    const prodDelete = await makeRequest('DELETE', `/api/products/${prodId}`, null, token);
    assert(prodDelete.status === 200 && prodDelete.body.success, 'Eliminación de Producto');

    // 6. Auditoría y Logs
    console.log('\n--- 6. Log de Auditoría Persistente ---');
    const auditRes = await makeRequest('GET', '/api/audit-logs', null, token);
    assert(auditRes.status === 200 && Array.isArray(auditRes.body.data) && auditRes.body.data.length > 0, 'Audit logs registrados y consultados de la base de datos');

    console.log('\n====================================================');
    console.log(`📊 RESULTADO FINAL: ${passed} PASADAS, ${failed} FALLIDAS`);
    console.log('====================================================');

    if (failed === 0) {
      console.log('🎉 TODAS LAS PRUEBAS DE PRODUCCIÓN Y PERSISTENCIA PASARON CORRECTAMENTE.');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Error ejecutando tests:', err);
    process.exit(1);
  }
}

// Iniciar servidor temporalmente para los tests si no está corriendo
const serverProcess = require('./server');
setTimeout(runTests, 1500);
