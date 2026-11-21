export class LearningScreens{
 constructor(saved={}){this.clinicalSeen=saved.clinicalSeen===true;this.pulpSeen=saved.pulpSeen===true;}
 next({ready,caseId,stage,mode,critical,modalOpen,near}){if(!ready||caseId!==1||stage!==2||mode!=='learn'||critical||modalOpen)return null;if(!this.clinicalSeen)return 'clinical';if(near&&!this.pulpSeen)return 'pulp';return null;}
 mark(kind){if(kind==='clinical')this.clinicalSeen=true;if(kind==='pulp')this.pulpSeen=true;}
 serialize(){return {clinicalSeen:this.clinicalSeen,pulpSeen:this.pulpSeen};}
}
