import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { CSVUpload } from './components/CSVUpload';
import { ShippingTable } from './components/ShippingTable';
import { FloatingStars } from './components/FloatingStars';
import { LogoComponent } from './components/LogoComponent';
import { ApiService } from './services/apiService';
import { RateComparisonService } from './services/rateComparisonService';
import { ShippingData } from './types';

const AppContainer = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px 0;
  border-bottom: 2px solid #e9ecef;
`;

const HeaderContent = styled.div`
  flex: 1;
  text-align: center;
`;


const Title = styled.h1`
  color: #212529;
  margin-bottom: 10px;
  font-size: 2.5rem;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const Subtitle = styled.p`
  color: #6c757d;
  font-size: 1.1rem;
  margin: 0;
`;

const ProgressContainer = styled.div`
  margin: 20px 0;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
`;

const ProgressText = styled.p`
  margin: 0;
  color: #495057;
  font-weight: 500;
`;

const ErrorContainer = styled.div`
  margin: 20px 0;
  padding: 15px;
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 600;
  color: #007bff;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

function App() {
  const [shippingData, setShippingData] = useState<ShippingData[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showStars, setShowStars] = useState(false);

  const apiService = useRef(new ApiService());
  const rateComparisonService = useRef(new RateComparisonService());

  useEffect(() => {
    setShowStars(true);
  }, []);

  const handleDataLoaded = useCallback(async (data: ShippingData[]) => {
    setShippingData(data);
    setIsCalculating(true);
    setError(null);
    setProgress('Initializing rate comparison service...');

    try {
      await rateComparisonService.current.initialize();
      setProgress('Calculating zones and comparing rates...');

      const updatedData: ShippingData[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        setProgress(`Processing record ${i + 1} of ${data.length}...`);

        try {
          let zone = '';

          if (row.CARRIER.toLowerCase().includes('fedex')) {
            zone = await apiService.current.getFedExZone(row.ORIGIN_ZIP, row.DESTINATION_ZIP);
          } else if (row.CARRIER.toLowerCase().includes('usps')) {
            zone = await apiService.current.getUSPSZone(row.ORIGIN_ZIP, row.DESTINATION_ZIP);
          } else if (row.CARRIER.toLowerCase().includes('ups')) {
            zone = await apiService.current.getUPSZone(row.ORIGIN_ZIP, row.DESTINATION_ZIP);
          } else {
            zone = await apiService.current.getUSPSZone(row.ORIGIN_ZIP, row.DESTINATION_ZIP);
          }

          const comparison = rateComparisonService.current.calculateSavings(row, zone);

          const updatedRow: ShippingData = {
            ...row,
            zone,
            negotiatedRate: comparison.negotiatedRate,
            savings: comparison.savings,
            isLoop: comparison.isLoop
          };

          updatedData.push(updatedRow);
          setShippingData([...updatedData]);

          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          console.error(`Error processing row ${i}:`, error);
          updatedData.push({
            ...row,
            zone: 'Error',
            negotiatedRate: 0,
            savings: 0,
            isLoop: false
          });
          setShippingData([...updatedData]);
        }
      }

      setProgress('Calculation complete!');
      setTimeout(() => setProgress(''), 3000);

    } catch (error) {
      console.error('Error during calculation:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during calculation');
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const calculateStats = () => {
    const totalRecords = shippingData.length;
    const loopSavings = shippingData.filter(row => row.isLoop === true).length;
    const totalSavings = shippingData.reduce((sum, row) => {
      return sum + (row.isLoop === true ? (row.savings || 0) : 0);
    }, 0);
    const averageSavings = loopSavings > 0 ? totalSavings / loopSavings : 0;

    return {
      totalRecords,
      loopSavings,
      totalSavings,
      averageSavings
    };
  };

  const stats = calculateStats();

  return (
    <AppContainer>
      <FloatingStars
        show={showStars}
        onComplete={() => setShowStars(false)}
      />
      <Header>
        <div /> {/* Spacer for left side */}
        <HeaderContent>
          <Title>Kent Woodyards Magical Unicorn Shipping Pricing App🦄</Title>
          <Subtitle>
            Upload CSV files to compare current shipping rates with Loop's negotiated rates
          </Subtitle>
        </HeaderContent>
        <LogoComponent />
      </Header>

      <CSVUpload onDataLoaded={handleDataLoaded} />

      {error && (
        <ErrorContainer>
          <strong>Error:</strong> {error}
        </ErrorContainer>
      )}

      {progress && (
        <ProgressContainer>
          <ProgressText>{progress}</ProgressText>
        </ProgressContainer>
      )}

      {shippingData.length > 0 && (
        <StatsContainer>
          <StatCard>
            <StatValue>{stats.totalRecords}</StatValue>
            <StatLabel>Total Records</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{stats.loopSavings}</StatValue>
            <StatLabel>Loop Savings</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>${stats.totalSavings.toFixed(2)}</StatValue>
            <StatLabel>Total Savings</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>${stats.averageSavings.toFixed(2)}</StatValue>
            <StatLabel>Avg per Shipment</StatLabel>
          </StatCard>
        </StatsContainer>
      )}

      <ShippingTable data={shippingData} isCalculating={isCalculating} />
    </AppContainer>
  );
}

export default App;
