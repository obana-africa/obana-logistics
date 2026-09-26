require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usersRoute = require("./src/routes/users");
const requestsRoute = require("./src/routes/requests");
const shipmentRoutes = require("./src/routes/shipments");
const routesManagement = require("./src/routes/routes");
const agentRoutes = require("./src/routes/agents");
const locations = require("./src/routes/locations")
const zohoRoutes = require("./src/routes/zoho");

const PORT = process.env.PORT;
const app = express();
// Render sits behind a proxy; needed for the real client IP (rate limits).
app.set("trust proxy", 1);

/* Zoho's workflow-rule webhooks post the ENTIRE sales order, and a sales order
   with eighty items carries every line's custom fields twice over — well past
   express.json()'s 100kb default. Express then answers 413 "Payload Too Large"
   before any route runs, Zoho records a failure and retries, and the shipment
   is never booked. It happened on SO-00683: six attempts, all 413.

   The body is not even read: /zoho/shipment-trigger takes salesorder_id from
   the query string and fetches the order from Zoho itself. So the limit here is
   only about accepting the request at all. Ten megabytes is far more than the
   largest order could produce, and it is scoped to /zoho so no other endpoint
   gains a bigger surface than it needs. */
app.use("/zoho", express.json({ limit: "10mb" }));
app.use("/zoho", express.urlencoded({ extended: false, limit: "10mb" }));
app.use(express.json());
const http = require("http");


// Create HTTP server
const server = http.createServer(app);



// Session and Passport setup
const session = require("express-session");
const passport = require("./src/config/passport");
app.use(
	session({ secret: process.env.SESSION_SECRET || "obana", resave: false, saveUninitialized: true })
);
app.use(passport.initialize());
app.use(passport.session());

/**
 * Cross Origin Request Service
 * -Set all allowed origins here to enable cross origin requests
 **/
const corsOptions = {
	origin: [
		"http://localhost:3000",
		"http://localhost:3001",
		"http://localhost:4005",
		"http://localhost:3005",
		"https://staging.salesforce.obana.africa",
		"https://staging.shop.obana.africa",
		
		"https://shop.obana.africa",
		"https://marketplace.obana.africa",
		"https://obana-staging.onrender.com",
		"https://logistics.obana.africa",
		"https://salesforce.obana.africa",
		"https://salespartner.obana.africa",
		"https://shop.obana.africa",
		"https://obana-logistics-psi.vercel.app",
		"https://obana-logistics.vercel.app",
		"https://obanasalesforce-2fbaoshjv-obanas-projects-fb636fb1.vercel.app",
		"https://saleslocal.obana.africa",
		"https://obana-shop-n0x0rhumj-obanas-projects-fb636fb1.vercel.app",
	],
};
app.use(cors(corsOptions));


const authRoute = require("./src/routes/auth").router;
app.use("/auth", authRoute);

/**
 * Swagger setup and definitions
 **/
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const swaggerOptions = {
	swaggerDefinition: {
		openapi: "3.0.0",
		info: {
			title: "Obana API",
			version: "1.0.0",
			description: "Obana E-Commerce API Docummentation",
			contact: {
				name: "Anyanwu Chimebuka",
			},
		},
		servers: [
			{
				url: `http://localhost:${PORT}`,
			},
			{
				url: `http://api.Obana.xyz`,
			},
		],
	},
	apis: ["./app.js", "./src/routes/*.js"],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use("/api-doc", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /:
 *  get:
 *    description: Default api test url
 *    responses:
 *      '200':
 *        description: API is running
 */
app.get("/", (req, res) => {
	res.send("Welcome to Obana Logistics.");
});

/**
 * Middlewares and routes
 **/

app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
	console.log(`${req.method} - ${req.url}`);
	next();
});

app.use("/shipments", shipmentRoutes);
app.use("/users", usersRoute);
app.use("/requests", requestsRoute);
app.use("/routes", routesManagement);
app.use("/tenants", require("./src/routes/tenants"));
app.use("/agents", agentRoutes);
app.use("/locations", locations)
app.use("/partners", require("./src/routes/partners"));
app.use("/stores", require("./src/routes/stores"));
app.use("/zoho", zohoRoutes);
app.use("/vendor-shipments", require("./src/routes/vendorShipments"));
 
server.listen(PORT, () => {
	console.log(`Obana Logistics is running on port ${PORT}`);
});
