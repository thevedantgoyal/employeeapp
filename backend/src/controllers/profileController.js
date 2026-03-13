import * as profileService from '../services/profileService.js';

export async function getMyProfile(req, res, next) {
  try {
    const profile = await profileService.getProfileByUserId(req.userId);
    if (!profile) {
      return res.status(404).json({ data: null, error: { message: 'Profile not found' } });
    }
    res.json({ data: profile, error: null });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const profile = await profileService.updateProfileByUserId(req.userId, req.body);
    res.json({ data: profile, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getAllProfiles(req, res, next) {
  try {
    const profiles = await profileService.getAllProfiles();
    res.json({ data: profiles, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getProfilesByTeam(req, res, next) {
  try {
    const { teamId } = req.params;
    const profiles = await profileService.getProfilesByTeamId(teamId);
    res.json({ data: profiles, error: null });
  } catch (err) {
    next(err);
  }
}
