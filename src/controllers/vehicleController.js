import { validationResult } from 'express-validator';

import vehicleService from '../services/vehicleService.js';
import vehicleMapper from '../mappers/vehicleMapper.js';
import dadataService from '../services/dadataService.js';
import { sendError } from '../utils/api.js';

export default {
  async me(req, res) {
    const list = await vehicleService.listForUser(req.user.id);
    return res.json({ vehicles: list.map(vehicleMapper.toPublic) });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const clean = await dadataService.cleanVehicle(req.body.vehicle);
      if (!clean) {
        return res.status(400).json({ error: 'invalid_vehicle' });
      }
      if (clean.qc === 1) {
        return res.status(400).json({ error: 'vehicle_qc1' });
      }
      if (clean.qc === 2) {
        return res.status(400).json({ error: 'invalid_vehicle' });
      }
      const vehicle = await vehicleService.createForUser(
        req.user.id,
        {
          brand: clean.brand,
          model: clean.model,
          number: req.body.number.toUpperCase(),
        },
        req.user.id
      );
      return res.status(201).json({ vehicle: vehicleMapper.toPublic(vehicle) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const vehicle = await vehicleService.updateForUser(
        req.user.id,
        req.params.id,
        { is_active: req.body.is_active },
        req.user.id
      );
      return res.json({ vehicle: vehicleMapper.toPublic(vehicle) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
