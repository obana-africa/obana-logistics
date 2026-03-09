const {Router} = require('express');
const tenantController = require('../controllers/tenantController')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     create_tenant:
 *       type: object
 *       required:
 *          - name
 *          - base_url
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the tenant
 *         base_url:
 *           type: string
 *           description: The base url of the tenant
 *         description:
 *           type: string
 *           description: The description of the services the tenant provides
 *         status:
 *           type: string
 *           description: Status of the tenant on our platform
 *         config:
 *           type: object
 *           description: Specific configuration settings for the tenant
 *       example:
 *         name: Faszion
 *         slug: faszion
 *         base_url: http://obana-logistics.com/api
 *         description: Fazsion API
 *         status: Enabled
 *         config: 
 *         registry: 
 */

 /**
  * @swagger
  * tags:
  *   name: TenantAPI
  *   description: The tenant management API
  */

/**
* @swagger
*  /tenants/create:
*  post:
*    summary: Create tenant
*    tags: [TenantAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_tenant'
*    responses:
*      '201':
*        description: Tenant created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_tenant'
*/
router.post('/create', tenantController.createTenant)

/**
 * @swagger
 * /tenants/register:
 *   post:
 *     summary: Register a new business tenant (onboarding)
 *     tags: [TenantAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - base_url
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Zoho CRM"
 *               slug:
 *                 type: string
 *                 example: "zohocrm"
 *               base_url:
 *                 type: string
 *                 example: "www.zohoapis.com/crm/v2"
 *               description:
 *                 type: string
 *                 example: "Zoho CRM Integration"
 *     responses:
 *       '201':
 *         description: Tenant registered successfully with API key
 *       '400':
 *         description: Invalid input or tenant already exists
 */
router.post('/register', tenantController.registerTenant)

/**
 * @swagger
 * /tenants/{id}:
 *   get:
 *     summary: Get tenant details
 *     tags: [TenantAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Tenant details
 *       '404':
 *         description: Tenant not found
 */
router.get('/:id', tenantController.getTenant)

/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: Get all tenants
 *     tags: [TenantAPI]
 *     responses:
 *       '200':
 *         description: List of all tenants
 */
router.get('', tenantController.getAllTenants)

/**
 * @swagger
 * /tenants/{id}/regenerate-key:
 *   post:
 *     summary: Regenerate API key for a tenant
 *     tags: [TenantAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: New API key generated successfully
 *       '404':
 *         description: Tenant not found
 */
router.post('/:id/regenerate-key', tenantController.regenerateApiKey)
router.post('/:id/regenerate-key', tenantController.regenerateApiKey)


/**
* @swagger
*  /tenants/update:
*  put:
*    summary: Update Tenant
*    tags: [TenantAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_tenant'
*    responses:
*      '200':
*        description: Tenant updated successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_tenant'
 */
router.put('/update', tenantController.updateTenant)


module.exports = router;