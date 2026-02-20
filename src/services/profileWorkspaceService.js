import { Task, TaskStatus, Ticket, TicketStatus } from '../models/index.js';
import userMapper from '../mappers/userMapper.js';
import passportMapper from '../mappers/passportMapper.js';
import innMapper from '../mappers/innMapper.js';
import snilsMapper from '../mappers/snilsMapper.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';
import taxationMapper from '../mappers/taxationMapper.js';
import addressMapper from '../mappers/addressMapper.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import vehicleMapper from '../mappers/vehicleMapper.js';

import userService from './userService.js';
import passportService from './passportService.js';
import innService from './innService.js';
import snilsService from './snilsService.js';
import bankAccountService from './bankAccountService.js';
import taxationService from './taxationService.js';
import addressService from './addressService.js';
import clubUserService from './clubUserService.js';
import teamService from './teamService.js';
import vehicleService from './vehicleService.js';

const ADDRESS_TYPES = ['REGISTRATION', 'RESIDENCE'];
const OPEN_TASK_STATUSES = new Set(['PENDING', 'IN_PROGRESS']);
const OPEN_TICKET_STATUSES = new Set(['CREATED', 'IN_PROGRESS']);
const TASK_OVERDUE_DAYS = 14;

function buildCompleteness(profile) {
  const checks = {
    passport: Boolean(profile.passport),
    inn: Boolean(profile.inn),
    snils: Boolean(profile.snils),
    bank_account: Boolean(profile.bank_account),
    addresses: Boolean(
      profile.addresses?.REGISTRATION && profile.addresses?.RESIDENCE
    ),
    taxation: Boolean(profile.taxation),
    vehicles: Array.isArray(profile.vehicles) && profile.vehicles.length > 0,
  };

  const keys = Object.keys(checks);
  const completed = keys.filter((key) => checks[key]).length;
  const score =
    keys.length > 0 ? Math.round((completed / keys.length) * 100) : 0;
  const missing = keys.filter((key) => !checks[key]);

  return { score, missing };
}

async function getRoleAliases(user) {
  if (!user || typeof user.getRoles !== 'function') return [];
  const roles = await user.getRoles({ attributes: ['alias'] });
  return roles.map((role) => role.alias).filter(Boolean);
}

async function getAddresses(userId) {
  const entries = await Promise.all(
    ADDRESS_TYPES.map(async (type) => {
      try {
        const address = await addressService.getForUser(userId, type);
        return [type, addressMapper.toPublic(address)];
      } catch {
        return [type, null];
      }
    })
  );

  return Object.fromEntries(entries);
}

async function getTaskSummary(userId) {
  const tasks = await Task.findAll({
    where: { user_id: userId },
    include: [{ model: TaskStatus, attributes: ['alias'] }],
    attributes: ['id', 'updated_at'],
  });

  const open = tasks.filter((task) =>
    OPEN_TASK_STATUSES.has(task.TaskStatus?.alias)
  ).length;

  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - TASK_OVERDUE_DAYS);

  const overdue = tasks.filter((task) => {
    if (!OPEN_TASK_STATUSES.has(task.TaskStatus?.alias)) return false;
    return task.updatedAt && new Date(task.updatedAt) < overdueDate;
  }).length;

  return {
    open,
    overdue,
  };
}

async function getTicketSummary(userId) {
  const tickets = await Ticket.findAll({
    where: { user_id: userId },
    include: [{ model: TicketStatus, attributes: ['alias'] }],
    attributes: ['id'],
  });

  const open = tickets.filter((ticket) =>
    OPEN_TICKET_STATUSES.has(ticket.TicketStatus?.alias)
  ).length;
  const inProgress = tickets.filter(
    (ticket) => ticket.TicketStatus?.alias === 'IN_PROGRESS'
  ).length;

  return {
    open,
    in_progress: inProgress,
  };
}

async function getWorkspace(userId, actorUser) {
  const user = await userService.getUser(userId);

  const [
    passport,
    inn,
    snils,
    bankAccount,
    taxation,
    addresses,
    clubs,
    teams,
    vehicles,
    taskSummary,
    ticketSummary,
    actorRoles,
  ] = await Promise.all([
    passportService.getByUser(userId),
    innService.getByUser(userId),
    snilsService.getByUser(userId),
    bankAccountService.getByUser(userId),
    taxationService.getByUser(userId),
    getAddresses(userId),
    clubUserService.listUserClubs(userId),
    teamService.listUserTeams(userId),
    vehicleService.listForUser(userId),
    getTaskSummary(userId),
    getTicketSummary(userId),
    getRoleAliases(actorUser),
  ]);

  const profile = {
    passport: passportMapper.toPublic(passport),
    inn: innMapper.toPublic(inn),
    snils: snilsMapper.toPublic(snils),
    bank_account: bankAccountMapper.toPublic(bankAccount),
    addresses,
    taxation: taxationMapper.toPublic(taxation),
    vehicles: vehicles.map(vehicleMapper.toPublic),
    sport_school_links: {
      clubs: clubs.map(clubMapper.toPublic),
      teams: teams.map(teamMapper.toPublic),
    },
  };

  return {
    user: userMapper.toPublic(user),
    profile,
    related: {
      tasks_summary: taskSummary,
      tickets_summary: ticketSummary,
    },
    completeness: buildCompleteness(profile),
    permissions: {
      can_edit_roles:
        actorRoles.includes('ADMIN') || actorRoles.includes('ADMINISTRATOR'),
      can_manage_links:
        actorRoles.includes('ADMIN') || actorRoles.includes('ADMINISTRATOR'),
    },
  };
}

export default {
  getWorkspace,
};
