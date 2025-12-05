import React from 'react';
import styled from 'styled-components';
import { ShippingData } from '../types';

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  margin: 20px 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  min-width: 1200px;
`;

const TableHeader = styled.th`
  background-color: #f8f9fa;
  color: #495057;
  font-weight: 600;
  padding: 12px 8px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  font-size: 14px;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background-color: #f8f9fa;
  }

  &:hover {
    background-color: #e9ecef;
  }
`;

const TableCell = styled.td`
  padding: 10px 8px;
  border-bottom: 1px solid #dee2e6;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
`;

const ZoneCell = styled(TableCell)<{ $isCalculated?: boolean }>`
  background-color: ${props => props.$isCalculated ? '#e3f2fd' : '#fff3e0'};
  font-weight: ${props => props.$isCalculated ? '600' : '400'};
  color: ${props => props.$isCalculated ? '#1565c0' : '#ef6c00'};
`;

const ComparisonCell = styled(TableCell)<{ $isLoop?: boolean }>`
  background-color: ${props =>
    props.$isLoop === true ? '#e8f5e8' :
    props.$isLoop === false ? '#ffebee' :
    '#f5f5f5'};
  font-weight: 600;
  color: ${props =>
    props.$isLoop === true ? '#2e7d32' :
    props.$isLoop === false ? '#d32f2f' :
    '#666'};
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 16px;
`;

interface ShippingTableProps {
  data: ShippingData[];
  isCalculating?: boolean;
}

export const ShippingTable: React.FC<ShippingTableProps> = ({ data, isCalculating }) => {
  if (data.length === 0) {
    return (
      <LoadingText>
        No data to display. Please upload a CSV file.
      </LoadingText>
    );
  }

  const formatWeight = (weightInGrams: string) => {
    const weight = parseFloat(weightInGrams);
    return isNaN(weight) ? weightInGrams : `${(weight / 453.592).toFixed(2)} lbs`;
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? 'N/A' : `$${num.toFixed(2)}`;
  };

  const formatSavings = (savings: number | undefined, isLoop: boolean | undefined) => {
    if (savings === undefined || isLoop === undefined) return 'Calculating...';
    const savingsText = `$${Math.abs(savings).toFixed(2)}`;
    return isLoop ? `Save ${savingsText}` : `+${savingsText} more`;
  };

  return (
    <TableContainer>
      <Table>
        <thead>
          <tr>
            <TableHeader>Tracking #</TableHeader>
            <TableHeader>Carrier</TableHeader>
            <TableHeader>Service</TableHeader>
            <TableHeader>Weight</TableHeader>
            <TableHeader>Current Rate</TableHeader>
            <TableHeader>Origin</TableHeader>
            <TableHeader>Destination</TableHeader>
            <TableHeader>Zone</TableHeader>
            <TableHeader>Loop Rate</TableHeader>
            <TableHeader>Comparison</TableHeader>
            <TableHeader>Date</TableHeader>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <TableRow key={`${row.TRACKING_NUMBER}_${index}`}>
              <TableCell title={row.TRACKING_NUMBER}>
                {row.TRACKING_NUMBER}
              </TableCell>
              <TableCell>{row.CARRIER}</TableCell>
              <TableCell title={row.LABEL_SERVICE}>
                {row.LABEL_SERVICE}
              </TableCell>
              <TableCell>{formatWeight(row.PKG_WEIGHT_IN_GRAMS)}</TableCell>
              <TableCell>
                {formatCurrency(row.TOTAL_LABEL_RATE_SHOPPER_CURRENCY || row.TOTAL_LABEL_RATE_USD)}
              </TableCell>
              <TableCell title={`${row.ORIGIN_CITY}, ${row.ORIGIN_STATE}`}>
                {row.ORIGIN_ZIP}
              </TableCell>
              <TableCell title={`${row.DESTINATION_CITY}, ${row.DESTINATION_STATE}`}>
                {row.DESTINATION_ZIP}
              </TableCell>
              <ZoneCell $isCalculated={!!row.zone}>
                {row.zone || (isCalculating ? 'Calculating...' : 'Pending')}
              </ZoneCell>
              <TableCell>
                {row.negotiatedRate ? formatCurrency(row.negotiatedRate) : 'N/A'}
              </TableCell>
              <ComparisonCell $isLoop={row.isLoop}>
                {formatSavings(row.savings, row.isLoop)}
              </ComparisonCell>
              <TableCell>{row.LABEL_CREATED_DATE}</TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
};