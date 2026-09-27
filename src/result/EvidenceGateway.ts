import type { MatchRecord } from '../match/MatchRepository.js';
import type { ResultSubmission } from './ResultRepository.js';

export interface EvidenceInput { url: string; filename: string; contentType: string | null; size: number }
export interface ArchivedEvidence {
  messageId: string; attachmentId: string; filename: string; contentType: string; size: number;
}

/** Discord effects are kept outside SQLite transactions and faked in tests. */
export interface EvidenceGateway {
  archiveEvidence(match: MatchRecord, submission: ResultSubmission, input: EvidenceInput): Promise<ArchivedEvidence>;
  editEvidenceCard(match: MatchRecord, submission: ResultSubmission): Promise<void>;
  editMatchStarter(match: MatchRecord): Promise<void>;
  deleteEvidenceMessage(threadId: string, messageId: string): Promise<void>;
}
