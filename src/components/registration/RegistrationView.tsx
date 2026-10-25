import React from 'react';
import { RegistrationManagementView } from './RegistrationManagementView';
import { NavTab } from '../common/Header';

interface RegistrationViewProps {
  onSelectTab?: (tab: NavTab) => void;
  onOpenPublicForm?: (season?: string) => void;
}

export const RegistrationView: React.FC<RegistrationViewProps> = ({
  onOpenPublicForm,
}) => {
  return <RegistrationManagementView onOpenPublicForm={onOpenPublicForm} />;
};
