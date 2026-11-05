import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ocrAccess, type OcrRole } from '../src/ocr-access.js';

const roles:OcrRole[]=['owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer'];

describe('role-wise OCR authorization',()=>{
  it('allows intake roles and denies client, support, and steward roles',()=>{
    for(const role of roles) assert.equal(ocrAccess.canIntake(role),['owner','admin','lawyer','analyst','operations'].includes(role),role);
  });
  it('keeps extraction corrections separate from intake and approval',()=>{
    for(const role of roles){
      assert.equal(ocrAccess.canCorrect(role),['owner','analyst'].includes(role),role);
      assert.equal(ocrAccess.canSubmit(role),['owner','analyst'].includes(role),role);
      assert.equal(ocrAccess.canDecide(role),role==='lawyer',role);
    }
  });
  it('limits cloud configuration, steward configuration, confidential access, clients, and support diagnostics',()=>{
    for(const role of roles){
      assert.equal(ocrAccess.canConfigure(role),['owner','admin'].includes(role),role);
      assert.equal(ocrAccess.canSteward(role),['owner','admin','data_steward'].includes(role),role);
      assert.equal(ocrAccess.canViewConfidential(role),['owner','admin','lawyer','analyst','operations'].includes(role),role);
      assert.equal(ocrAccess.canViewApproved(role),['consultant','viewer'].includes(role),role);
      assert.equal(ocrAccess.canSupportDiagnostics(role),role==='support',role);
    }
  });
});
