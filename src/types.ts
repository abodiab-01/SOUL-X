export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';
export type Gender = 'male' | 'female';

export interface UserProfileDetails {
  birthDate: string; // Format: YYYY-MM-DD
  gender: Gender;
  country?: string;
}

export interface AuthUser {
  id: string;
  displayId?: string;
  name: string;
  email: string;
  photoUrl?: string;
  createdAt: string;
  birthDate?: string | null;
  gender?: Gender | null;
  country?: string | null;
  walletBalance?: number;
  coinsBalance?: number;
  bio?: string;
  isAdmin?: boolean;
  twoFactorEnabled?: boolean;
  reportsCount?: number;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  isFrozen?: boolean;
  frozenAt?: string | null;
  freezeDurationMinutes?: number | null;
  freezeExpiresAt?: string | null;
  freezeReason?: string | null;
  isVerified?: boolean;
  equippedFrameId?: string | null;
}

export interface AccountRestrictionInfo {
  status?: 'active' | 'frozen' | 'banned';
  isFrozen: boolean;
  isBanned: boolean;
  frozenAt?: string | null;
  freezeDurationMinutes?: number | null;
  freezeExpiresAt?: string | null;
  remainingMs?: number;
  serverNow?: number;
  receivedAt?: number;
  freezeReason?: string | null;
  bannedAt?: string | null;
  banReason?: string | null;
}

export interface BlockedUserRecord {
  id: string;
  blockerId: string;
  blockerDisplayId?: string;
  blockedId: string;
  blockedDisplayId?: string;
  name: string;
  displayId?: string;
  photoUrl?: string;
  gender?: Gender | null;
  country?: string | null;
  bio?: string;
  blockedAt: string;
  isVerified?: boolean;
}

export interface SavedAccount {
  id: string;
  displayId: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  gender?: Gender | null;
  birthDate?: string | null;
  country?: string | null;
  lastLogin: string;
  refreshToken?: string;
  token?: string;
  refreshExpiresAt?: string;
  autoLoginEnabled?: boolean;
  isVerified?: boolean;
}

export interface AgentRecord {
  id: string;
  gridCode?: string; // رقم القريد للوكيل مثال A8838
  email: string;
  name: string;
  nameEn?: string;
  taglineAr?: string;
  taglineEn?: string;
  country: string;
  flag: string;
  balance: number;
  category: 'recharge' | 'withdraw' | 'both';
  methods: string[];
  responseTimeAr?: string;
  responseTimeEn?: string;
  rating?: number;
  completedOrders?: number;
  whatsapp?: string;
  telegram?: string;
  isOnline?: boolean;
  minAmount?: number;
  maxAmount?: number;
  rateNoteAr?: string;
  rateNoteEn?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface AgencyWithdrawalRequest {
  id: string;
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  agentName: string;
  gridCode: string;
  amount: number;
  fee?: number;
  netCredited?: number;
  usdAmount?: number;
  netUsdAmount?: number;
  method: string;
  accountDetails: string;
  notes?: string;
  status: 'pending' | 'completed' | 'rejected';
  userId?: string;
  userDisplayId?: string;
  userName?: string;
  type?: 'agency_cashout' | 'incoming_user_withdrawal';
  createdAt: string;
  updatedAt?: string;
  adminNote?: string;
}

export interface AgencyRechargeTransaction {
  id: string;
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  gridCode: string;
  targetUserId: string;
  targetUserDisplayId?: string;
  targetUserName: string;
  amount: number;
  grossAmount?: number;
  feeAmount?: number;
  feePercentage?: number;
  usdAmount?: number;
  netUsdAmount?: number;
  payoutMethod?: string;
  accountDetails?: string;
  type?: 'recharge' | 'user_withdrawal';
  timestamp: string;
  previousBalance?: number;
  newBalance?: number;
}

export interface AgencyNotification {
  id: string;
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  gridCode: string;
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  feePercentage: number;
  usdAmount: number;
  netUsdAmount: number;
  userId: string;
  userDisplayId: string;
  userName: string;
  timestamp: string;
  read: boolean;
  type: 'incoming_user_withdrawal' | 'user_withdrawal' | 'recharge' | 'system';
}

export interface UserNotification {
  id: string;
  userId: string;
  userDisplayId?: string;
  type: 'friend_request_accepted' | 'agency_recharge' | 'withdrawal_request' | 'admin_broadcast' | 'admin_message';
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    friendId?: string;
    friendDisplayId?: string;
    friendName?: string;
    friendAvatar?: string;
    agentId?: string;
    agentGridCode?: string;
    agentName?: string;
    amount?: number;
    diamondsAmount?: number;
    currency?: 'coins';
    txId?: string;
    orderId?: string;
    withdrawalId?: string;
    previousBalance?: number;
    newBalance?: number;
    isAdminMessage?: boolean;
    isBroadcast?: boolean;
    broadcastId?: string;
    category?: 'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward';
    priority?: 'normal' | 'important' | 'urgent';
    senderName?: string;
    recipientName?: string;
    recipientDisplayId?: string;
    recipientEmail?: string;
  };
}

export interface FeedbackReport {
  id: string;
  userId?: string;
  userName?: string;
  userDisplayId?: string;
  userEmail?: string;
  userAvatar?: string;
  type: 'bug' | 'suggestion' | 'feedback' | 'user_report';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deviceInfo?: string;
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  createdAt: string;
  adminNotes?: string;
  adminReply?: string;
  // User report specific fields
  reportedUserId?: string;
  reportedUserDisplayId?: string;
  reportedUserName?: string;
  reportedUserAvatar?: string;
  reportedUserEmail?: string;
  reason?: string;
  source?: 'chat' | 'matching';
}

export interface PasswordResetRequest {
  id: string;
  source?: 'web' | 'telegram';
  userId?: string;
  userDisplayId?: string;
  userEmail?: string;
  userName?: string;
  telegramUserId?: number | string;
  telegramUsername?: string;
  telegramLink?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  chatId?: number | string;
  contactNote?: string;
  status: 'pending' | 'contacted' | 'resolved' | 'cancelled';
  requestedAt: string;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SearchUserResult {
  id: string;
  displayId?: string;
  originalId?: string;
  name: string;
  nameEn?: string;
  username?: string;
  avatar: string;
  bio: string;
  bioEn?: string;
  gender?: Gender | null;
  age?: number;
  country?: string;
  location?: string;
  matchScore: number;
  status: 'online' | 'offline';
  isFriend?: boolean;
  hasPendingRequest?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  equippedFrameId?: string | null;
}

export interface VerificationRequestRecord {
  id: string;
  userId: string;
  userDisplayId?: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  idFrontImage: string;
  idBackImage: string;
  selfieWithIdImage: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramAuthResult {
  isTelegram: boolean;
  isVerified: boolean;
  user: TelegramUser | null;
  authDate?: number;
  error?: string;
  message?: string;
  isSimulated?: boolean;
}

export interface Project {
  id: string;
  title: {
    ar: string;
    en: string;
  };
  category: {
    ar: string;
    en: string;
  };
  categoryKey: 'hardware' | 'digital' | 'spatial';
  year: string;
  tagline: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  metrics: {
    ar: string;
    en: string;
  };
  image: string;
  details: {
    ar: string[];
    en: string[];
  };
  specs: {
    label: { ar: string; en: string };
    value: { ar: string; en: string };
  }[];
}

export interface Pillar {
  number: string;
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  deliverable: {
    ar: string;
    en: string;
  };
}

// ==========================================
// SOUL-X Rooms Types (نظام الغرف الاجتماعية والصوتية)
// ==========================================
export type RoomCategory = 'chat' | 'music' | 'games' | 'chill' | 'culture' | 'vip';

export type RoomRole = 'owner' | 'head_admin' | 'moderator' | 'member';

export interface RoomModPermissions {
  manageSeats: boolean;
  muteUsers: boolean;
  roomMuteAll: boolean;
  acceptMicQueue: boolean;
  kickUsers: boolean;
  banUsers: boolean;
  deleteMessages: boolean;
  pinMessages: boolean;
  pauseChat: boolean;
  manageLockPin: boolean;
  manageGames: boolean;
  manageMusic: boolean;
  manageEvents: boolean;
}

export interface RoomSeatInfo {
  seatNumber: number; // 1..15
  userId: string | null;
  displayId?: string | null;
  name?: string | null;
  avatar?: string | null;
  isVerified?: boolean;
  equippedFrameId?: string | null;
  role?: RoomRole | null;
  isLocked: boolean;
  isMutedBySelf: boolean;
  isMutedByMod: boolean;
  isSpeaking?: boolean;
  reconnecting?: boolean;
  occupiedAt?: string | null;
}

export interface RoomOccupantInfo {
  userId: string;
  displayId?: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  equippedFrameId?: string | null;
  role: RoomRole;
  seatNumber: number | null;
  isMicOpen: boolean;
  isMutedByMod: boolean;
  isSpeaking: boolean;
  reconnecting?: boolean;
  joinedAt: string;
}

export interface RoomQueueItem {
  userId: string;
  displayId?: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  equippedFrameId?: string | null;
  requestedAt: string;
}

export interface RoomMessageRecord {
  id: string;
  roomId: string;
  senderId?: string | null;
  senderName?: string | null;
  senderAvatar?: string | null;
  senderRole?: RoomRole | 'system' | null;
  senderIsVerified?: boolean;
  senderFrameId?: string | null;
  msgType: 'text' | 'system' | 'gift' | 'announcement';
  text: string;
  metadata?: Record<string, any> | null;
  isPinned?: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface RoomModRecord {
  userId: string;
  displayId?: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  role: 'head_admin' | 'moderator';
  permissions: RoomModPermissions;
  assignedBy: string;
  createdAt: string;
}

export interface RoomBanRecord {
  id: string;
  roomId: string;
  userId: string;
  displayId?: string;
  name: string;
  avatar?: string;
  banType: 'ban' | 'kick';
  reason?: string | null;
  bannedBy: string;
  bannedByName?: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface RoomEventRecord {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  startsAt: string;
  createdBy: string;
  createdByName?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  rsvpUserIds: string[];
  createdAt: string;
}

export interface RoomAuditLogRecord {
  id: string;
  roomId: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  targetUserId?: string | null;
  targetUserName?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface RoomMusicState {
  isPlaying: boolean;
  trackId: string;
  trackTitleAr: string;
  trackTitleEn: string;
  artist?: string;
  startedAtMs: number;
  offsetSec: number;
  controlledBy?: string;
  controlledByName?: string;
}

export type RoomMiniGameType = 'quiz' | 'true_false' | 'word_guess' | 'who_am_i' | 'speed_challenge';

export interface RoomGameQuestion {
  index: number;
  promptAr: string;
  promptEn: string;
  optionsAr?: string[];
  optionsEn?: string[];
  hintAr?: string;
  hintEn?: string;
}

export interface RoomGameState {
  status: 'idle' | 'active' | 'round_result' | 'finished';
  gameType: RoomMiniGameType | null;
  gameId: string | null;
  startedBy?: string;
  startedByName?: string;
  roundNumber: number;
  totalRounds: number;
  question: RoomGameQuestion | null;
  roundStartedAtMs: number;
  roundDurationSec: number;
  answeredUserIds: string[];
  correctAnswerAr?: string;
  correctAnswerEn?: string;
  winnerName?: string | null;
  leaderboard: Array<{
    userId: string;
    name: string;
    avatar?: string;
    score: number;
  }>;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  category: RoomCategory;
  coverUrl: string;
  ownerId: string;
  ownerDisplayId?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerIsVerified?: boolean;
  ownerFrameId?: string | null;
  isPublic: boolean;
  isLocked: boolean;
  isFeatured: boolean;
  isHidden?: boolean;
  isFrozen?: boolean;
  freezeReason?: string | null;
  frozenAt?: string | null;
  isRoomMuted: boolean;
  occupantsCount: number;
  occupiedSeatsCount: number;
  maxSeats: number;
  isActive: boolean;
  friendsInsideCount: number;
  isFavorite: boolean;
  isOwnedByMe: boolean;
  totalGiftsCoins: number;
  createdAt: string;
  lastActivityAt: string;
}

export interface RoomDetail extends RoomSummary {
  chatEnabled: boolean;
  chatPaused: boolean;
  micRequestsEnabled: boolean;
  queueEnabled: boolean;
  invitesEnabled: boolean;
  gamesPermission: 'owner' | 'moderators' | 'all';
  musicPermission: 'owner' | 'moderators';
  notificationsEnabled: boolean;
  pinnedMessageId?: string | null;
  pinnedMessage?: RoomMessageRecord | null;
  myRole: RoomRole;
  myPermissions: RoomModPermissions;
  isMutedByMod: boolean;
}

export interface AdminRoomRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  category: RoomCategory;
  coverUrl: string;
  ownerId: string;
  ownerDisplayId?: string;
  ownerName: string;
  ownerEmail?: string;
  ownerAvatar?: string;
  ownerIsVerified?: boolean;
  isPublic: boolean;
  isLocked: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  isFrozen: boolean;
  freezeReason?: string | null;
  frozenAt?: string | null;
  isRoomMuted: boolean;
  occupantsCount: number;
  occupiedSeatsCount: number;
  maxSeats: number;
  totalGiftsCoins: number;
  moderatorsCount: number;
  messagesCount: number;
  createdAt: string;
  lastActivityAt: string;
}

