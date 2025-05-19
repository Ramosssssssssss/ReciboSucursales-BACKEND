const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Firebird = require('node-firebird');
const {
    fileTypeFromBuffer
} = require('file-type');

const app = express();
const PORT = 3051;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
}));
app.use(bodyParser.json());

const firebirdConfig = {
    host: '85.215.109.213',
    port: 3050,
    database: 'D:\\Microsip datos\\GUIMARTEST.FDB',
    user: 'SYSDBA',
    password: 'BlueMamut$23',
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    // timelife: 25,
};
app.post('/consulta-traspaso', (req, res) => {
    const { folio, sucursalDestinoId } = req.body;

    Firebird.attach(firebirdConfig, function (err, db) {
        if (err) {
            console.error('Error de conexión a Firebird:', err);
            return res.status(500).json({ error: 'Error al conectar a la base de datos.' });
        }

        const caratulaQuery = `
            SELECT TRASPASO_IN_ID, FOLIO, FECHA, A.NOMBRE AS ORIGEN, A2.NOMBRE AS DESTINO, TI.ESTATUS 
            FROM TRASPASOS_IN TI
            INNER JOIN ALMACENES A ON A.ALMACEN_ID = TI.ALMACEN_ORIGEN_ID
            INNER JOIN ALMACENES A2 ON A2.ALMACEN_ID = TI.ALMACEN_DESTINO_ID
            WHERE FOLIO = ? AND ESTATUS = 'E' AND TI.SUCURSAL_DESTINO_ID = ?
        `;

        db.query(caratulaQuery, [folio, sucursalDestinoId], function (err, result) {
            if (err) {
                db.detach();
                console.error('Error en la consulta de carátula:', err);
                return res.status(500).json({ error: 'Error al consultar carátula del traspaso.' });
            }

            if (result.length === 0) {
                db.detach();
                return res.status(404).json({ error: 'Traspaso no encontrado o no autorizado para esta sucursal.' });
            }

            const traspaso = result[0]; // Tiene TRASPASO_IN_ID

            const detallesQuery = `
                SELECT TID.CLAVE_ARTICULO, NOMBRE, UNIDADES, A.UNIDAD_VENTA AS UMED, CA.CLAVE_ARTICULO AS CODIGOB 
                FROM TRASPASOS_IN_DET TID
                INNER JOIN ARTICULOS A ON A.ARTICULO_ID = TID.ARTICULO_ID
                INNER JOIN CLAVES_ARTICULOS CA ON CA.ARTICULO_ID = TID.ARTICULO_ID
                WHERE TRASPASO_IN_ID = ? AND CA.ROL_CLAVE_ART_ID = 58486
            `;

            db.query(detallesQuery, [traspaso.TRASPASO_IN_ID], function (err, detalles) {
                db.detach();
                if (err) {
                    console.error('Error en la consulta de detalles:', err);
                    return res.status(500).json({ error: 'Error al consultar detalles del traspaso.' });
                }

                return res.json({
                    caratula: traspaso,
                    detalles: detalles,
                });
            });
        });
    });
});
app.post('/recibir-traspaso', (req, res) => {
    const { traspasoId } = req.body;

    if (!traspasoId) {
        return res.status(400).json({ error: 'Falta el ID del traspaso.' });
    }

    Firebird.attach(firebirdConfig, function (err, db) {
        if (err) {
            console.error('Error de conexión a Firebird:', err);
            return res.status(500).json({ error: 'Error al conectar a la base de datos.' });
        }

        const updateQuery = `UPDATE TRASPASOS_IN SET ESTATUS = 'R' WHERE TRASPASO_IN_ID = ?`;

        db.query(updateQuery, [traspasoId], function (err, result) {
            db.detach();
            if (err) {
                console.error('Error al actualizar traspaso:', err);
                return res.status(500).json({ error: 'Error al actualizar el traspaso.' });
            }

            return res.json({ message: 'Traspaso recibido correctamente.' });
        });
    });
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en http://0.0.0.0:${PORT}`);
});