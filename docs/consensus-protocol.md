# Consensus Protocol: Round-Robin Debate System

## Debate Parameters
- **Participants**: Sentiment, Valuation, Risk (Compliance optional)
- **Round-robin**: 3 rounds max
- **Opinion schema**: { stance: BUY|HOLD|SELL, confidence: 0..1, rationale: string, features: Record<string,number|string> }
- **Aggregation**: weighted majority by confidence; if tie → defer to Risk; if still tie → HOLD
- **Guardrails**: if Risk flags critical (e.g., honeypot/owner not renounced + extreme concentration), cap stance at HOLD
- **Output**: { decision, confidence, rationale[], auditTrailId }

## Debate Flow
1. **Initial Opinions**: All agents submit initial stance and confidence
2. **Round 1**: Sentiment → Valuation → Risk (each can modify stance based on others)
3. **Round 2**: Valuation → Risk → Sentiment (refinement and rebuttal)
4. **Round 3**: Risk → Sentiment → Valuation (final positions and consensus)
5. **Decision**: Weighted aggregation with Risk as tie-breaker

## Confidence Weighting
- **High Confidence (0.8-1.0)**: 3x weight multiplier
- **Medium Confidence (0.5-0.79)**: 2x weight multiplier  
- **Low Confidence (0.1-0.49)**: 1x weight multiplier
- **Abstain (0.0)**: No vote, requires quorum adjustment

## Quorum & Validation
- **Minimum Participation**: 2 out of 3 agents must provide opinions
- **Confidence Threshold**: Minimum 0.3 confidence for valid opinion
- **Audit Trail**: All debate rounds and decision rationale preserved
- **Fallback**: If consensus fails, default to HOLD with low confidence
