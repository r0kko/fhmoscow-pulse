export { default as Banner } from './models/banner.js';
export { default as BannerPosition } from './models/bannerPosition.js';
export { default as BasicDocument } from './models/basicDocument.js';
export { default as BasicDocumentParentCategory } from './models/basicDocumentParentCategory.js';
export { default as City } from './models/city.js';
export { default as Club } from './models/club.js';
export { default as ClubPlayer } from './models/clubPlayer.js';
export { default as ClubStaff } from './models/clubStaff.js';
export { default as Country } from './models/country.js';
export { default as CustomScore } from './models/customScore.js';
export { default as DoctrineMigrationVersions } from './models/doctrineMigrationVersions.js';
export { default as Document } from './models/document.js';
export { default as ExtFile } from './models/file.js';
export { default as Game } from './models/game.js';
export { default as GameAssignment } from './models/gameAssignment.js';
export { default as GameEvent } from './models/gameEvent.js';
export { default as GameEventType } from './models/gameEventType.js';
export { default as GamePeriod } from './models/gamePeriod.js';
export { default as GamePlayer } from './models/gamePlayer.js';
export { default as GameReferee } from './models/gameReferee.js';
export { default as GameRemark } from './models/gameRemark.js';
export { default as GameSetting } from './models/gameSetting.js';
export { default as GameSituation } from './models/gameSituation.js';
export { default as GameStaff } from './models/gameStaff.js';
export { default as GameStatus } from './models/gameStatus.js';
export { default as GameViolation } from './models/gameViolation.js';
export { default as TournamentGroup } from './models/tournamentGroup.js';
export { default as Log } from './models/log.js';
export { default as Media } from './models/media.js';
export { default as MessengerMessages } from './models/messengerMessages.js';
export { default as News } from './models/news.js';
export { default as NewsImage } from './models/newsImage.js';
export { default as NewsTags } from './models/newsTags.js';
export { default as OvertimeType } from './models/overtimeType.js';
export { default as PageEditor } from './models/pageEditor.js';
export { default as PayerType } from './models/payerType.js';
export { default as PenaltyMinutes } from './models/penaltyMinutes.js';
export { default as Photo } from './models/photo.js';
export { default as PhotoImage } from './models/photoImage.js';
export { default as PhotoTags } from './models/photoTags.js';
export { default as Player } from './models/player.js';
export { default as PlayerPosition } from './models/playerPosition.js';
export { default as PlayerStatistic } from './models/playerStatistic.js';
export { default as Protocol } from './models/protocol.js';
export { default as Referee } from './models/referee.js';
export { default as RefereeCategory } from './models/refereeCategory.js';
export { default as RefereeDocument } from './models/refereeDocument.js';
export { default as RefereeQualification } from './models/refereeQualification.js';
export { default as RefereeQualificationHockeyLeague } from './models/refereeQualificationHockeyLeague.js';
export { default as RefereeTaxation } from './models/refereeTaxation.js';
export { default as RefreshTokens } from './models/refreshTokens.js';
export { default as Report } from './models/report.js';
export { default as ReportStatus } from './models/reportStatus.js';
export { default as Sdk } from './models/sdk.js';
export { default as Season } from './models/season.js';
export { default as SeasonResults } from './models/seasonResults.js';
export { default as Sex } from './models/sex.js';
export { default as Sponsor } from './models/sponsor.js';
export { default as Stadium } from './models/stadium.js';
export { default as Staff } from './models/staff.js';
export { default as StaffCategory } from './models/staffCategory.js';
export { default as StaffStatistic } from './models/staffStatistic.js';
export { default as Stage } from './models/stage.js';
export { default as Tags } from './models/tags.js';
export { default as Team } from './models/team.js';
export { default as TeamPlayer } from './models/teamPlayer.js';
export { default as TeamPlayerRole } from './models/teamPlayerRole.js';
export { default as TeamStaff } from './models/teamStaff.js';
export { default as Tour } from './models/tour.js';
export { default as Tournament } from './models/tournament.js';
export { default as TournamentSetting } from './models/tournamentSetting.js';
export { default as TournamentTable } from './models/tournamentTable.js';
export { default as TournamentTeam } from './models/tournamentTeam.js';
export { default as TournamentType } from './models/tournamentType.js';
export { default as User } from './models/user.js';
export { default as UserClub } from './models/userClub.js';
export { default as UserTeam } from './models/userTeam.js';
export { default as Video } from './models/video.js';
export { default as VideoTags } from './models/videoTags.js';

export async function setupExternalAssociations() {
  const models = {
    Banner: (await import('./models/banner.js')).default,
    BannerPosition: (await import('./models/bannerPosition.js')).default,
    ExtFile: (await import('./models/file.js')).default,
    BasicDocument: (await import('./models/basicDocument.js')).default,
    BasicDocumentParentCategory: (
      await import('./models/basicDocumentParentCategory.js')
    ).default,
    Season: (await import('./models/season.js')).default,
    Tournament: (await import('./models/tournament.js')).default,
    City: (await import('./models/city.js')).default,
    Country: (await import('./models/country.js')).default,
    Club: (await import('./models/club.js')).default,
    Tags: (await import('./models/tags.js')).default,
    ClubPlayer: (await import('./models/clubPlayer.js')).default,
    Photo: (await import('./models/photo.js')).default,
    Player: (await import('./models/player.js')).default,
    TeamPlayerRole: (await import('./models/teamPlayerRole.js')).default,
    ClubStaff: (await import('./models/clubStaff.js')).default,
    Staff: (await import('./models/staff.js')).default,
    StaffCategory: (await import('./models/staffCategory.js')).default,
    CustomScore: (await import('./models/customScore.js')).default,
    Team: (await import('./models/team.js')).default,
    TournamentGroup: (await import('./models/tournamentGroup.js')).default,
    Document: (await import('./models/document.js')).default,
    Game: (await import('./models/game.js')).default,
    Stadium: (await import('./models/stadium.js')).default,
    Tour: (await import('./models/tour.js')).default,
    GameAssignment: (await import('./models/gameAssignment.js')).default,
    GameEvent: (await import('./models/gameEvent.js')).default,
    GameEventType: (await import('./models/gameEventType.js')).default,
    GameSituation: (await import('./models/gameSituation.js')).default,
    GameViolation: (await import('./models/gameViolation.js')).default,
    PenaltyMinutes: (await import('./models/penaltyMinutes.js')).default,
    PlayerPosition: (await import('./models/playerPosition.js')).default,
    TeamPlayer: (await import('./models/teamPlayer.js')).default,
    GamePlayer: (await import('./models/gamePlayer.js')).default,
    GameReferee: (await import('./models/gameReferee.js')).default,
    Referee: (await import('./models/referee.js')).default,
    GameRemark: (await import('./models/gameRemark.js')).default,
    GameSetting: (await import('./models/gameSetting.js')).default,
    OvertimeType: (await import('./models/overtimeType.js')).default,
    TournamentType: (await import('./models/tournamentType.js')).default,
    GameStaff: (await import('./models/gameStaff.js')).default,
    Report: (await import('./models/report.js')).default,
    ReportStatus: (await import('./models/reportStatus.js')).default,
    Sdk: (await import('./models/sdk.js')).default,
    SeasonResults: (await import('./models/seasonResults.js')).default,
    Sponsor: (await import('./models/sponsor.js')).default,
    News: (await import('./models/news.js')).default,
    NewsImage: (await import('./models/newsImage.js')).default,
    NewsTags: (await import('./models/newsTags.js')).default,
    PhotoImage: (await import('./models/photoImage.js')).default,
    PhotoTags: (await import('./models/photoTags.js')).default,
    Video: (await import('./models/video.js')).default,
    VideoTags: (await import('./models/videoTags.js')).default,
    User: (await import('./models/user.js')).default,
    UserClub: (await import('./models/userClub.js')).default,
    UserTeam: (await import('./models/userTeam.js')).default,
    Log: (await import('./models/log.js')).default,
    Sex: (await import('./models/sex.js')).default,
    PayerType: (await import('./models/payerType.js')).default,
    RefereeCategory: (await import('./models/refereeCategory.js')).default,
    RefereeQualification: (
      await import('./models/refereeQualification.js')
    ).default,
    RefereeQualificationHockeyLeague: (
      await import('./models/refereeQualificationHockeyLeague.js')
    ).default,
    RefereeDocument: (await import('./models/refereeDocument.js')).default,
    RefereeTaxation: (await import('./models/refereeTaxation.js')).default,
    Protocol: (await import('./models/protocol.js')).default,
  };

  for (const model of Object.values(models)) {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  }
}

