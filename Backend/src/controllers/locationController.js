const axios = require('axios');
const utils = require('../../utils');

const BASE_URL = process.env.NEXT_PUBLIC_TERMINAL_AFRICA_BASE_URL || 'https://sandbox.terminal.africa/v1';
const SECRET_KEY = process.env.NEXT_PUBLIC_TERMINAL_AFRICA_SECRET_KEY || 'sk_test_u9dHWJILEe6F9b4etSZ5gPvO6qTXiG1i';

const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

const getCountries = async (req, res) => {
    try {
        const response = await apiClient.get('/countries');
        const countries = response.data.data.map(c => ({
            name: c.name,
            isoCode: c.iso_code
        }));
        return res.status(200).send(utils.responseSuccess(countries));
    } catch (error) {
        console.error('Error fetching countries:', error.message);
        return res.status(500).send(utils.responseError(error.response?.data?.message || error.message));
    }
};

const getStates = async (req, res) => {
    try {
        const { country_code } = req.query;
        const response = await apiClient.get(`/states?country_code=${country_code}`);
        const states = response.data.data.map(s => ({
            name: s.name,
            isoCode: s.iso_code
        }));
        return res.status(200).send(utils.responseSuccess(states));
    } catch (error) {
        console.error('Error fetching states:', error.message);
        return res.status(500).send(utils.responseError(error.response?.data?.message || error.message));
    }
};

const getCities = async (req, res) => {
    try {
        const { country_code, state_code } = req.query;
        const response = await apiClient.get(`/cities?country_code=${country_code}&state_code=${state_code}`);
        // Terminal Africa cities usually just have names, we map to standard format
        const cities = response.data.data.map(c => ({ name: c.name }));
        return res.status(200).send(utils.responseSuccess(cities));
    } catch (error) {
        console.error('Error fetching cities:', error.message);
        return res.status(500).send(utils.responseError(error.response?.data?.message || error.message));
    }
};

module.exports = {
    getCountries,
    getStates,
    getCities
};