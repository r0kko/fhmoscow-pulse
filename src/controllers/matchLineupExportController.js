import exportService from '../services/matchLineupExportService.js';

async function exportPlayers(req, res, next) {
  try {
    const { team_id: teamId } = req.query || {};
    if (!teamId) return res.status(400).json({ error: 'team_id_required' });
    const buf = await exportService.exportPlayersPdf(
      req.params.id,
      teamId,
      req.user.id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="lineup.pdf"');
    return res.end(buf);
  } catch (e) {
    if (e.code && Number.isFinite(e.code))
      return res.status(e.code).json({ error: e.message });
    next(e);
  }
}

async function exportRepresentatives(req, res, next) {
  try {
    const { team_id: teamId } = req.query || {};
    if (!teamId) return res.status(400).json({ error: 'team_id_required' });
    const buf = await exportService.exportRepresentativesPdf(
      req.params.id,
      teamId,
      req.user.id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="representatives.pdf"'
    );
    return res.end(buf);
  } catch (e) {
    if (e.code && Number.isFinite(e.code))
      return res.status(e.code).json({ error: e.message });
    next(e);
  }
}

export default { exportPlayers, exportRepresentatives };
