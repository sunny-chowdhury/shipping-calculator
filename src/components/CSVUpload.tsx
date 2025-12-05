import React, { useState } from 'react';
import Papa from 'papaparse';
import styled from 'styled-components';
import { ShippingData } from '../types';

const UploadContainer = styled.div`
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  text-align: center;
  margin: 20px 0;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #007bff;
    background-color: #e6f3ff;
  }

  &.dragover {
    border-color: #007bff;
    background-color: #e6f3ff;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const UploadLabel = styled.label`
  cursor: pointer;
  display: block;
  width: 100%;
  height: 100%;
`;

const UploadText = styled.p`
  margin: 10px 0;
  color: #666;
  font-size: 16px;
`;

const ErrorMessage = styled.p`
  color: #d32f2f;
  margin-top: 10px;
`;

const SuccessMessage = styled.p`
  color: #2e7d32;
  margin-top: 10px;
`;

interface CSVUploadProps {
  onDataLoaded: (data: ShippingData[]) => void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ onDataLoaded }) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    setError(null);
    setSuccess(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`CSV parsing error: ${result.errors[0].message}`);
          return;
        }

        const data = result.data as ShippingData[];

        if (data.length === 0) {
          setError('No data found in CSV file');
          return;
        }

        const requiredFields = ['ORIGIN_ZIP', 'DESTINATION_ZIP', 'PKG_WEIGHT_IN_GRAMS'];
        const firstRow = data[0];
        const missingFields = requiredFields.filter(field => !(field in firstRow));

        if (missingFields.length > 0) {
          setError(`Missing required fields: ${missingFields.join(', ')}`);
          return;
        }

        setSuccess(`Successfully loaded ${data.length} records`);
        onDataLoaded(data);
      },
      error: (error) => {
        setError(`Error reading file: ${error.message}`);
      }
    });
  };

  return (
    <UploadContainer
      className={dragOver ? 'dragover' : ''}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <UploadLabel htmlFor="csv-upload">
        <UploadText>
          <strong>Drop CSV file here</strong> or click to select
        </UploadText>
        <UploadText>
          Accepts CSV files with shipping data including origin/destination ZIP codes and package weights
        </UploadText>
      </UploadLabel>
      <FileInput
        id="csv-upload"
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
    </UploadContainer>
  );
};