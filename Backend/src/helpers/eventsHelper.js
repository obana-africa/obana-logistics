class EventstHelper {

    requestDetails

    constructor(requestDetails) {
        this.requestDetails = requestDetails
      
    }

    helpers = async (req, res) => {
        this.requestDetails.exit = true

        const { route, endpoint } = this.requestDetails.query
        switch (route) {
            case '':
                //
                break
            case "":
               
                break
            case "":
               
                break
            case "":
                //

        }
    }

    async rateConversionFallBack() {
        const date = this.requestDetails.req.query.date ?? new Date().toISOString().split('T')[0]
        const currency = this.requestDetails.req.query.currency ?? 'usd'
        const mainResponse = await JSON.parse(this.requestDetails?.response ?? "{}")
        if (!mainResponse?.success) {
            const url = `https://${date}.${process.env.CURRENCY_CONVERTION_BACKUP_URL}/${currency}.json`
            const rate = await axios.get(url, {})

            const symbol = Object.keys(rate.data)[1]
            const rates = rate.data[symbol]
            const forex = []
            if (Object.keys(rates) < 1) return
            for (let key in rates) {
                let formData = {
                    "symbol": key.toUpperCase(),
                    "buy": rates[key],
                    "sell": rates[key]
                }
                forex.push(formData)
            }
            this.requestDetails.res.status(rate.status).send({
                "success": true,
                "message": "forex",
                "data": forex
            })
            this.requestDetails.exit = true
        }
    }




    createReport = async () => {
        const payload = this.requestDetails.payload;
        const { name, customer, customer_email, next_step_follow_up, action_update, priority, status, follow_up_due_date } = payload;

        if (!name || !customer || !customer_email) {
            throw this.requestDetails.res.status(400).send({
                message: 'Missing required fields: name, customer, customer_email',
                code: 400
            });
        }

        const zohoPayload = {
            data: [{
                Name: name,
                Customer: customer,
                Customer_Email: customer_email,
                Next_Step_Follow_up: next_step_follow_up,
                Action_Update: action_update,
                Priority: priority,
                Status: status,
                Follow_up_Due_Date: follow_up_due_date
            }]
        };

        this.requestDetails.headers.Authorization = await this.crmToken();

        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'create-sales-partner-report';
        this.requestDetails.req.body = zohoPayload;

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-create' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success || !parsedResponse.data) {
            throw this.requestDetails.res.status(400).send({
                message: 'Failed to create report in Zoho',
                code: 400,
                details: parsedResponse.message || parsedResponse
            });
        }

        const reportId = parsedResponse.data[0]?.id || parsedResponse.data[0]?.Report_Salespartner?.id;

        this.requestDetails.response = {
            statusCode: 201,
            data: {
                report_id: reportId,
                message: 'Report created successfully in Zoho',
                data: parsedResponse.data[0]
            }
        };
        this.requestDetails.exit = true;
    };

    getReport = async () => {
        const { report_id, name, customer, customer_email, from_date, to_date, status } = this.requestDetails.req.query;

        // Build Zoho search criteria
        let searchCriteria = '';
        if (name) searchCriteria += `Name:equals:${name},`;
        if (customer) searchCriteria += `Customer:equals:${customer},`;
        if (customer_email) searchCriteria += `Customer_Email:equals:${customer_email},`;
        if (status) searchCriteria += `Status:equals:${status},`;
        if (from_date && to_date) {
            searchCriteria += `Created_Time_Date:greater_equal:${from_date},Created_Time_Date:less_equal:${to_date},`;
        }
        searchCriteria = searchCriteria.slice(0, -1);

        this.requestDetails.headers.Authorization = await this.crmToken();

        // Prepare request
        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'get-sales-partner-report';
        this.requestDetails.req.query = {
            ...this.requestDetails.req.query,
            criteria: searchCriteria || '',
            fields: 'Name,Customer,Customer_Email,Next_Step_Follow_up,Action_Update,Priority,Status,Follow_up_Due_Date,Created_Time_Date',
            page: this.requestDetails.req.query.page || 1,
            per_page: this.requestDetails.req.query.per_page || 20
        };

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-get' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success) {
            throw this.requestDetails.res.status(404).send({
                message: 'No reports found',
                code: 404,
                details: parsedResponse.message || parsedResponse
            });
        }

        this.requestDetails.response = {
            statusCode: 200,
            data: {
                reports: parsedResponse.data || [],
                total: parsedResponse.info?.count || 0
            }
        };
        this.requestDetails.exit = true;
    };

    updateReport = async () => {
        const { report_id } = this.requestDetails.req.query;
        const payload = this.requestDetails.payload;
        const { name, customer, customer_email, next_step_follow_up, action_update, priority, status, follow_up_due_date } = payload;

        if (!report_id) {
            throw this.requestDetails.res.status(400).send({
                message: 'Missing required field: report_id',
                code: 400
            });
        }

        const zohoPayload = {
            data: [{
                id: report_id,
                Name: name,
                Customer: customer,
                Customer_Email: customer_email,
                Next_Step_Follow_up: next_step_follow_up,
                Action_Update: action_update,
                Priority: priority,
                Status: status,
                Follow_up_Due_Date: follow_up_due_date
            }]
        };

        this.requestDetails.headers.Authorization = await this.crmToken();

        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'update-sales-partner-report';
        this.requestDetails.req.query = { id: report_id };
        this.requestDetails.req.body = zohoPayload;

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-update' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success || !parsedResponse.data) {
            throw this.requestDetails.res.status(400).send({
                message: 'Failed to update report in Zoho',
                code: 400,
                details: parsedResponse.message || parsedResponse
            });
        }

        this.requestDetails.response = {
            statusCode: 200,
            data: {
                report_id,
                message: 'Report updated successfully in Zoho',
                data: parsedResponse.data[0]
            }
        };
        this.requestDetails.exit = true;
    };

}


module.exports.EventstHelper = EventstHelper
