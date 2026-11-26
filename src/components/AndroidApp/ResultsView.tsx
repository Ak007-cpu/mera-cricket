import React from 'react';
import { MatchHistoryView } from './MatchHistoryView';

export const ResultsView: React.FC<{
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
  onOpenLiveMatch?: () => void;
}> = (props) => {
  return <MatchHistoryView {...props} />;
};

export { MatchHistoryView };
export default ResultsView;
