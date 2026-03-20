require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usersRoute = require("./src/routes/users");
const requestsRoute = require("./src/routes/requests");
const shipmentRoutes = require("./src/routes/shipments");
const routesManagement = require("./src/routes/routes");
const agentRoutes = require("./src/routes/agents");
const locations = require("./src/routes/locations")

const PORT = process.env.PORT;
const app = express();

app.use(express.json());
const http = require("http");


// Create HTTP server
const server = http.createServer(app);



// Session and Passport setup
const session = require("express-session");
const passport = require("./src/config/passport");
app.use(
	session({ secret: "obana", resave: false, saveUninitialized: true })
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
		"https://logistics.obana.africa",
		"https://obana-logistics-psi.vercel.app",
		"https://obana-logistics.vercel.app",
	],
};
app.use(cors(corsOptions));

// Mount Google OAuth routes
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
	res.send("Welcome to Obana Project.");
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
 
server.listen(PORT, () => {
	console.log(`Obana is running on port ${PORT}`);
});
